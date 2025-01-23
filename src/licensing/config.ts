// Copyright 2024 The MathWorks, Inc.

import { promises as fs } from 'fs';
import { findExecutableOnPath, resolveSymlink } from '../utils/FsUtils';
import * as path from 'path';
import * as xml2js from 'xml2js';
import { VersionInfoXML } from './types';
import Logger from '../logging/Logger';

const VERSION_INFO_FILENAME = 'VersionInfo.xml';

export const MWI_AUTH_TOKEN_NAME_FOR_HTTP = 'mwi-auth-token'

export const MWI_AUTH_TOKEN_LENGTH = 32

export const MWI_ENABLE_TOKEN_AUTH = true

export const MWI_LICENSING_SESSION_COOKIE_NAME = 'matlab-licensing-session'

let installPath: string | null = null;
let matlabVersion: string | null = null;
export const staticFolderPath: string = path.join(__dirname, 'licensing', 'static')

/**
 * Sets the MATLAB install path. Is called when:
 * 1) The LSP is initialzed
 * &
 * 2) The installPath setting changes by its config change handler
 * @param path - The MATLAB install path
 */
export function setInstallPath (path: string): void {
    installPath = path;

    // When installPath changes, update MATLAB version
    getMatlabVersionFromInstallPath(installPath).then((version) => {
        matlabVersion = version;
    }, () => {});
}

/**
 * Sets the MATLAB version. This function is called to update the current
 * MATLAB version in the application state.
 *
 * @param version - The MATLAB version to be set
 */
export function setMatlabVersion (version: string): void {
    matlabVersion = version
}

/**
 * Gets the MATLAB version
 * @returns {Promise<string | null>} The MATLAB version or null if it cannot be determined
 */
export async function getMatlabVersion (): Promise<string | null> {
    // If MATLAB version was already determined (either by this function or the setInstallPath function), return it directly.
    if (matlabVersion !== null) {
        return matlabVersion
    } else {
        const matlabExecutableOnPath = await findExecutableOnPath('matlab')
        // If there's no matlab executable on system PATH return null
        if (matlabExecutableOnPath === null) {
            return null;
        }

        const absoluteMatlabPath = await resolveSymlink(matlabExecutableOnPath);
        const matlabRoot = path.resolve(absoluteMatlabPath, '..', '..')

        // Update matlabVersion variable before returning to avoid recomputation.
        matlabVersion = await getMatlabVersionFromInstallPath(matlabRoot)
        return matlabVersion
    }
}

/**
 * Retrieves the MATLAB version from the installation path.
 *
 * @param pathToMatlabRoot - The path to the MATLAB ROOT.
 * @returns {Promise<string|null>} A promise that resolves to the MATLAB version as a string, or null if an error occurs.
 */
async function getMatlabVersionFromInstallPath (pathToMatlabRoot: string): Promise<string | null> {
    const versionInfoPath = path.join(pathToMatlabRoot, VERSION_INFO_FILENAME);

    try {
        const fileContent = await fs.readFile(versionInfoPath, { encoding: 'utf-8' })
        const xmlData = (await xml2js.parseStringPromise(fileContent)) as VersionInfoXML
        const versionInfo = xmlData.MathWorks_version_info.release[0]
        return versionInfo
    } catch (error) {
        Logger.error(`Failed to read version info file at path:${versionInfoPath} with error:${error as string}`)
        return null;
    }
}
