// Copyright 2024 The MathWorks, Inc.

import { Server as HttpServer } from 'http';
import { AddressInfo } from 'net';
import express from 'express';
import os from 'os'
import fs from 'fs'
import path from 'path'

import { addRoutes } from './routes';
import { addMiddlwares } from './middlewares'
import { generateAuthToken } from './tokenAuth';
import { MWI_AUTH_TOKEN_LENGTH, MWI_AUTH_TOKEN_NAME_FOR_HTTP } from '../config';
import MatlabLifecycleManager from '../../lifecycle/MatlabLifecycleManager';

import { deleteFile, writeJSONDataToFile } from '../../utils/FsUtils';
import { isPortFree } from '../../utils/NetworkUtils';

let server: HttpServer | express.Express | null = null; let port: number | null = null;
let licensingUrlFilePath : string = path.join(os.tmpdir(), "url.json")

export let matlabLifecycleManager: MatlabLifecycleManager;
/**
 * The URL of the running server.
 */
export let url: string | null = null;

/**
 * Starts the server and returns its URL.
 *
 * @param buildPath - The path to the build directory.
 * @returns {string} The URL of the running server.
 */
export async function startLicensingServer (buildPath: string, mLM: MatlabLifecycleManager): Promise<string> {
    if (url !== null) {
        return url; 
    }

    // If in a codespaces environment, getExistingUrl() will return 
    // a previously started licensing server in the event of a page reload.
    const existingUrl = await getExistingUrl()
    if(existingUrl) {
        url = existingUrl
        return url
    }
    
    matlabLifecycleManager = mLM;

    server = express()
    addMiddlwares(server, buildPath)

    // Add routes
    addRoutes(server);

    // Start the server on a random port.
    const app = server.listen(0);
    const address = app.address() as AddressInfo;
    port = address.port;

    // Generate auth token
    const authToken = generateAuthToken(MWI_AUTH_TOKEN_LENGTH);

    url = `http://localhost:${port}/index.html?${MWI_AUTH_TOKEN_NAME_FOR_HTTP}=${authToken}`

    // Write url to file for handling new server start on page reload.
    writeJSONDataToFile(licensingUrlFilePath, {url: url})    

    return url
}

/**
 * Stops the running server.
 */
export function stopLicensingServer (): void {
    if (server != null) {
        (server as HttpServer).close(() => {
            console.log('Server stopped successfully');
        });

        deleteFile(licensingUrlFilePath).then(() => {})
    }
}

/**
 * Retrieves an existing URL of the licensing server if it was started previously. Useful in Github codespaces.

 * @returns {Promise<string>} A promise resolving to the URL string if the port is occupied, or an empty string otherwise.
 */
async function getExistingUrl() : Promise<string> {
    if(fs.existsSync(licensingUrlFilePath)){
        const data = JSON.parse(fs.readFileSync(licensingUrlFilePath, 'utf8'))
        const serverUrl = new URL(data.url)

        if(await isPortFree(Number(serverUrl.port))){
            return ''   
        } else {
            return serverUrl.toString();
        }

    }
    return ''
}

