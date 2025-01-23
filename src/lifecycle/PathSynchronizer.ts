// Copyright 2024 The MathWorks, Inc.

import { WorkspaceFolder, WorkspaceFoldersChangeEvent } from 'vscode-languageserver'
import ClientConnection, { Connection } from '../ClientConnection'
import Logger from '../logging/Logger'
import MatlabLifecycleManager from './MatlabLifecycleManager'
import { MatlabConnection } from './MatlabCommunicationManager'
import * as os from 'os'
import path from 'path'

export default class PathSynchronizer {
    readonly CD_REQUEST_CHANNEL = '/matlabls/pathSynchronizer/cd/request'

    readonly PWD_REQUEST_CHANNEL = '/matlabls/pathSynchronizer/pwd/request'
    readonly PWD_RESPONSE_CHANNEL = '/matlabls/pathSynchronizer/pwd/response'

    readonly ADDPATH_REQUEST_CHANNEL = '/matlabls/pathSynchronizer/addpath/request'
    readonly RMPATH_REQUEST_CHANNEL = '/matlabls/pathSynchronizer/rmpath/request'

    constructor (private readonly matlabLifecycleManager: MatlabLifecycleManager) {}

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

        this.matlabLifecycleManager.eventEmitter.on('connected', () => this.handleMatlabConnected(clientConnection))

        clientConnection.workspace.onDidChangeWorkspaceFolders(event => this.handleWorkspaceFoldersChanged(event))
    }

    /**
     * Handles synchronizing the MATLAB path with the current workspace folders when MATLAB
     * has been connected.
     *
     * @param clientConnection The current client connection
     */
    private async handleMatlabConnected (clientConnection: Connection): Promise<void> {
        const matlabConnection = await this.matlabLifecycleManager.getMatlabConnection()
        if (matlabConnection == null) {
            // As the connection was just established, this should not happen
            Logger.warn('MATLAB connection is unavailable after connection established')
            return
        }

        const workspaceFolders = await clientConnection.workspace.getWorkspaceFolders()
        if (workspaceFolders == null || workspaceFolders.length === 0) {
            // No workspace folders - no action needs to be taken
            return
        }

        const folderPaths = this.convertWorkspaceFoldersToFilePaths(workspaceFolders)

        // cd to first workspace folder
        this.setWorkingDirectory(folderPaths[0], matlabConnection)

        // add all workspace folders to path
        this.addToPath(folderPaths, matlabConnection)
    }

    /**
     * Handles synchronizing the MATLAB path with newly added/removed workspace folders.
     *
     * @param event The workspace folders change event
     */
    private async handleWorkspaceFoldersChanged (event: WorkspaceFoldersChangeEvent): Promise<void> {
        const matlabConnection = await this.matlabLifecycleManager.getMatlabConnection()
        if (matlabConnection == null) {
            return
        }

        const cwd = await this.getCurrentWorkingDirectory(matlabConnection)

        // addpath for all added folders
        const addedFolderPaths = this.convertWorkspaceFoldersToFilePaths(event.added)
        this.addToPath(addedFolderPaths, matlabConnection)

        // rmpath for all removed folders
        const removedFolderPaths = this.convertWorkspaceFoldersToFilePaths(event.removed)
        this.removeFromPath(removedFolderPaths, matlabConnection)

        // log warning if primary workspace folder was removed
        if (this.isCwdInPaths(removedFolderPaths, cwd)) {
            Logger.warn('The current working directory was removed from the workspace.')
        }
    }

    private setWorkingDirectory (path: string, matlabConnection: MatlabConnection): void {
        Logger.log(`CWD set to: ${path}`)

        matlabConnection.publish(this.CD_REQUEST_CHANNEL, {
            path
        })
    }

    private getCurrentWorkingDirectory (matlabConnection: MatlabConnection): Promise<string> {
        const channelId = matlabConnection.getChannelId()
        const channel = `${this.PWD_RESPONSE_CHANNEL}/${channelId}`

        return new Promise<string>(resolve => {
            const responseSub = matlabConnection.subscribe(channel, message => {
                const cwd = message as string
                matlabConnection.unsubscribe(responseSub)
                resolve(path.normalize(cwd))
            })

            matlabConnection.publish(this.PWD_REQUEST_CHANNEL, {
                channelId
            })
        })
    }

    private addToPath (paths: string[], matlabConnection: MatlabConnection): void {
        if (paths.length === 0) return

        Logger.log(`Adding workspace folder(s) to the MATLAB Path: \n\t${paths.join('\n\t')}`)
        matlabConnection.publish(this.ADDPATH_REQUEST_CHANNEL, {
            paths
        })
    }

    private removeFromPath (paths: string[], matlabConnection: MatlabConnection): void {
        if (paths.length === 0) return

        Logger.log(`Removing workspace folder(s) from the MATLAB Path: \n\t${paths.join('\n\t')}`)
        matlabConnection.publish(this.RMPATH_REQUEST_CHANNEL, {
            paths
        })
    }

    private convertWorkspaceFoldersToFilePaths (workspaceFolders: WorkspaceFolder[]): string[] {
        return workspaceFolders.map(folder => {
            let uri = decodeURIComponent(folder.uri)
            uri = uri.replace('file:///', '')
            return path.normalize(uri)
        });
    }

    private isCwdInPaths (folderPaths: string[], cwd: string): boolean {
        if (os.platform() === 'win32') {
            // On Windows, paths are case-insensitive
            return folderPaths.some(folderPath => folderPath.toLowerCase() === cwd.toLowerCase());
        } else {
            // On Unix-like systems, paths are case-sensitive
            return folderPaths.includes(cwd);
        }
    }
}
