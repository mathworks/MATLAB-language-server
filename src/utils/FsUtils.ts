// Copyright 2024 The MathWorks, Inc.

import * as fs from 'fs/promises';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import Logger from '../logging/Logger';

const execPromise = promisify(exec);

/**
 * Creates a directory if it does not exist.
 * @param directoryPath - The path of the directory to create.
 * @returns {Promise<void>}
 */
export async function createDirectoryIfNotExist (directoryPath: string): Promise<void> {
    try {
        await fs.mkdir(directoryPath, { recursive: true });
        Logger.log(`Directory created or already exists: ${directoryPath}`);
    } catch (error) {
        Logger.error(`Error creating directory: ${(error as NodeJS.ErrnoException).message}`);
    }
}

/**
 * Writes JSON data to a file.
 * @param filePath - The path of the file to write to.
 * @param data - The data to write to the file.
 * @returns {Promise<void>}
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
export async function writeJSONDataToFile (filePath: string, data: any): Promise<void> {
    try {
        const dataString = JSON.stringify(data, null, 4);
        await fs.writeFile(filePath, dataString, 'utf8');
        Logger.log(`File written successfully to ${filePath}`);
    } catch (error) {
        Logger.error(`Error writing file: ${(error as NodeJS.ErrnoException).message}`);
    }
}

/**
 * Deletes a file.
 * @param filePath - The path of the file to delete.
 * @returns {Promise<void>}
 */
export async function deleteFile (filePath: string): Promise<void> {
    try {
        await fs.unlink(filePath);
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
            Logger.log(`File at path ${filePath} does not exist`);
        } else {
            Logger.error(`Error deleting file: ${String(error)}`);
        }
    }
}

/**
 * Resolves a symbolic link to its target path.
 * @param executablePath - The path of the symbolic link.
 * @returns {Promise<string>} The resolved target path.
 */
export async function resolveSymlink (executablePath: string | null): Promise<string> {
    if (executablePath === null || executablePath === undefined || executablePath === '') {
        return '';
    }
    try {
        const linkTarget = await fs.readlink(executablePath);
        const absolutePath = await fs.realpath(linkTarget);
        return absolutePath;
    } catch (error) {
        return path.resolve(executablePath);
    }
}

/**
 * Asynchronously finds the path of an executable on the system's PATH.
 *
 * @param executable - The name of the executable to find.
 * @returns {Promise<string|null>} A promise that resolves to the path of the executable if found, or null if not found.
 */
export async function findExecutableOnPath (executable: string): Promise<string | null> {
    try {
        const { stdout } = await execPromise(`which ${executable}`);
        return stdout.trim();
    } catch (err) {
        return null;
    }
}
