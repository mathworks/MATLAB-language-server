// Copyright 2024 The MathWorks, Inc.

import fetch, { RequestInit, Response } from 'node-fetch';
import { getProxyAgent } from './ProxyUtils';
import net from 'net';

/**
 * Sends an HTTP request to the specified URL with the provided options.
 *
 * @param url - The URL to send the request to.
 * @param options - The options for the request.
 * @returns {Promise<Response | null>} A Promise that resolves with the Response object if the request is successful, or null if an error occurs.
 */
export default async function sendRequest (url: string, options: RequestInit): Promise<Response | null> {
    try {
        const proxyAgent = getProxyAgent(url);
        if (proxyAgent != null) {
            options.agent = proxyAgent;
            console.log(`Will use NETWORK PROXY for sending request to: ${url}`);
        }

        const response = await fetch(url, options)
        if (!response.ok) {
            throw new Error(`Error: ${response.status}`);
        }
        return response;
    } catch (error) {
        console.error('Failed to send HTTP request: ', error)
        return null;
    }
}

/**
 * Checks if a specified port is free to use.
 *
 * @param  port - The port number to check.
 * @returns {Promise<boolean>} A promise that resolves to `true` if the port is free or `false` if the port is occupied.
 */
export function isPortFree (port: number): Promise<boolean> {
    return new Promise((resolve) => {
        const server = net.createServer();

        server.once('error', (err: {code: string}) => {
            if (err.code === 'EADDRINUSE') {
                resolve(false);
            } else {
                resolve(false);
            }
        });

        server.once('listening', () => {
            server.close(() => {
                resolve(true);
            });
        });

        server.listen(port);
    });
}
