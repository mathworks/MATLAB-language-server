// Copyright 2024-2025 The MathWorks, Inc.

import { WorkspaceFolder, WorkspaceFoldersChangeEvent } from 'vscode-languageserver'
import ClientConnection, { Connection } from '../ClientConnection'
import Logger from '../logging/Logger'
import MatlabLifecycleManager from './MatlabLifecycleManager'
import * as os from 'os'
import path from 'path'
import MVM, { IMVM, MatlabState } from '../mvm/impl/MVM'
import parse from '../mvm/MdaParser'
import * as FileNameUtils from '../utils/FileNameUtils'

export default class PathSynchronizer {
    constructor (private readonly matlabLifecycleManager: MatlabLifecycleManager, private readonly mvm: MVM) {}

    /**
     * Initializes the PathSynchronizer by setting up event listeners.
     *
     * Upon MATLAB connection, all workspace folders are added to the MATLAB search path.
     * Additionally, MATLAB's CWD is set to the first workspace folder to avoid potential
     * function shadowing issues.
     *
     * As workspace folders are added or removed, the MATLAB path is updated accordingly.
     */
    initialize (): void {
        const clientConnection = ClientConnection.getConnection()

        this.mvm.on(IMVM.Events.stateChange, (state: MatlabState) => {
            if (state === MatlabState.READY) {
                void this.handleMatlabConnected(clientConnection)
            }
        })

        clientConnection.workspace.onDidChangeWorkspaceFolders(event => this.handleWorkspaceFoldersChanged(event))
    }

    /**
     * Handles synchronizing the MATLAB path with the current workspace folders when MATLAB
     * has been connected.
     *
     * @param clientConnection The current client connection
     */
    private async handleMatlabConnected (clientConnection: Connection): Promise<void> {
        if (!this.mvm.isReady()) {
            // As the connection was just established, this should not happen
            Logger.warn('MVM is not ready after connection established')
            return
        }

        const workspaceFolders = await clientConnection.workspace.getWorkspaceFolders()
        if (workspaceFolders == null || workspaceFolders.length === 0) {
            // No workspace folders - no action needs to be taken
            return
        }

        const folderPaths = this.convertWorkspaceFoldersToFilePaths(workspaceFolders)

        // cd to first workspace folder
        void this.setWorkingDirectory(folderPaths[0])

        // add all workspace folders to path
        void this.addToPath(folderPaths)
    }

    /**
     * Handles synchronizing the MATLAB path with newly added/removed workspace folders.
     *
     * @param event The workspace folders change event
     */
    private async handleWorkspaceFoldersChanged (event: WorkspaceFoldersChangeEvent): Promise<void> {
        if (!this.mvm.isReady()) {
            // MVM not yet ready
            return
        }

        const cwd = await this.getCurrentWorkingDirectory()

        // addpath for all added folders
        const addedFolderPaths = this.convertWorkspaceFoldersToFilePaths(event.added)
        void this.addToPath(addedFolderPaths)

        // rmpath for all removed folders
        const removedFolderPaths = this.convertWorkspaceFoldersToFilePaths(event.removed)
        void this.removeFromPath(removedFolderPaths)

        // log warning if primary workspace folder was removed
        if (this.isCwdInPaths(removedFolderPaths, cwd)) {
            Logger.warn('The current working directory was removed from the workspace.')
        }
    }

    private async setWorkingDirectory (path: string): Promise<void> {
        try {
            const response = await this.mvm.feval('cd', 0, [path])

            if ('error' in response) {
                Logger.error('Error received while setting MATLAB\'s working directory:')
                Logger.error(response.error.msg)
            } else {
                Logger.log(`CWD set to: ${path}`)
            }
        } catch (err) {
            Logger.error('Error caught while setting MATLAB\'s working directory:')
            Logger.error(err as string)
        }
    }

    private async getCurrentWorkingDirectory (): Promise<string> {
        try {
            const response = await this.mvm.feval('pwd', 0, [])

            if ('error' in response) {
                Logger.error('Error received while getting MATLAB\'s working directory:')
                Logger.error(response.error.msg)
                return ''
            }

            return parse(response.result[0])
        } catch (err) {
            Logger.error('Error caught while getting MATLAB\'s working directory:')
            Logger.error(err as string)
            return ''
        }
    }

    private async addToPath (paths: string[]): Promise<void> {
        if (paths.length === 0) return

        Logger.log(`Adding workspace folder(s) to the MATLAB Path: \n\t${paths.join('\n\t')}`)

        try {
            const response = await this.mvm.feval('addpath', 0, [paths.join(path.delimiter)])

            if ('error' in response) {
                Logger.error('Error received while adding paths to the MATLAB path:')
                Logger.error(response.error.msg)
            }
        } catch (err) {
            Logger.error('Error caught while adding paths to the MATLAB path:')
            Logger.error(err as string)
        }
    }

    private async removeFromPath (paths: string[]): Promise<void> {
        if (paths.length === 0) return

        Logger.log(`Removing workspace folder(s) from the MATLAB Path: \n\t${paths.join('\n\t')}`)

        try {
            const response = await this.mvm.feval('rmpath', 0, [paths.join(path.delimiter)])

            if ('error' in response) {
                Logger.error('Error received while removing paths from the MATLAB path:')
                Logger.error(response.error.msg)
            }
        } catch (err) {
            Logger.error('Error caught while removing paths from the MATLAB path:')
            Logger.error(err as string)
        }
    }

    private convertWorkspaceFoldersToFilePaths (workspaceFolders: WorkspaceFolder[]): string[] {
        return workspaceFolders.map(folder => {
            return path.normalize(FileNameUtils.getFilePathFromUri(folder.uri))
        });
    }

    private isCwdInPaths (folderPaths: string[], cwd: string): boolean {
        if (os.platform() === 'win32') {
            // On Windows, paths are case-insensitive
            return folderPaths.some(folderPath => folderPath.toLowerCase() === cwd.toLowerCase())
        } else {
            // On Unix-like systems, paths are case-sensitive
            return folderPaths.includes(cwd)
        }
    }
}
