// Copyright 2025 The MathWorks, Inc.

import path from 'path';
import { URI } from 'vscode-uri';

/**
 * Checks if the given URI corresponds to a MATLAB M-file.
 *
 * @param uri The URI of the file to check
 * @returns True if the file is a MATLAB M-file (.m), false otherwise.
 */
export function isMFile (uri: string): boolean {
    const ext = path.extname(URI.parse(uri).fsPath)
    return ext === '.m'
}

/**
 * Gets the file path from the given URI, optionally coercing the extension to '.m'.
 *
 * @param uri The URI of the file
 * @param shouldCoerceToMExt If true, the function will ensure the returned file path has a
 * '.m' extension. If the file is a Jupyter Notebook ('.ipynb'), it will return 'untitled.m'
 * to ensure a valid MATLAB file name (to avoid invalid characters).
 * @returns The file path, optionally with the file extension replaced with '.m'.
 */
export function getFilePathFromUri (uri: string, shouldCoerceToMExt: boolean = false): string {
    const filePath = URI.parse(uri).fsPath

    const parsedPath = path.parse(filePath)

    if (!shouldCoerceToMExt || parsedPath.ext === '.m') {
        return filePath
    }

    if (parsedPath.ext === '') {
        // The file path has no extension
        return `${filePath}.m`
    }

    if (parsedPath.ext === '.ipynb') {
        // Use a default name for Jupyter Notebook files, to avoid code analysis
        // errors due to potential invalid characters in the file name.
        return 'untitled.m'
    }

    // For all other file types, replace the existing extension with '.m'
    return path.join(parsedPath.dir, `${parsedPath.name}.m`)
}
