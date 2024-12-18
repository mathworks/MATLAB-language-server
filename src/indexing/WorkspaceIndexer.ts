// Copyright 2022 - 2024 The MathWorks, Inc.

import { ClientCapabilities, WorkspaceFolder, WorkspaceFoldersChangeEvent } from 'vscode-languageserver'
import ConfigurationManager from '../lifecycle/ConfigurationManager'
import Indexer from './Indexer'
import ClientConnection from '../ClientConnection'

/**
 * Handles indexing files in the user's workspace to gather data about classes,
 * functions, and variables.
 */
export default class WorkspaceIndexer {
    private isWorkspaceIndexingSupported = false

    constructor (private readonly indexer: Indexer) {}

    /**
     * Sets up workspace change listeners, if supported.
     *
     * @param capabilities The client capabilities, which contains information about
     * whether the client supports workspaces.
     */
    setupCallbacks (capabilities: ClientCapabilities): void {
        this.isWorkspaceIndexingSupported = capabilities.workspace?.workspaceFolders ?? false

        if (!this.isWorkspaceIndexingSupported) {
            // Workspace indexing not supported
            return
        }

        ClientConnection.getConnection().workspace.onDidChangeWorkspaceFolders((params: WorkspaceFoldersChangeEvent) => {
            void this.handleWorkspaceFoldersAdded(params.added)
        })
    }

    /**
     * Attempts to index the files in the user's workspace.
     */
    async indexWorkspace (): Promise<void> {
        if (!(await this.shouldIndexWorkspace())) {
            return
        }

        const folders = await ClientConnection.getConnection().workspace.getWorkspaceFolders()

        if (folders == null) {
            return
        }

        void this.indexer.indexFolders(folders.map(folder => folder.uri))
    }

    /**
     * Handles when new folders are added to the user's workspace by indexing them.
     *
     * @param folders The list of folders added to the workspace
     */
    private async handleWorkspaceFoldersAdded (folders: WorkspaceFolder[]): Promise<void> {
        if (!(await this.shouldIndexWorkspace())) {
            return
        }

        void this.indexer.indexFolders(folders.map(folder => folder.uri))
    }

    /**
     * Determines whether or not the workspace should be indexed.
     * The workspace should be indexed if the client supports workspaces, and if the
     * workspace indexing setting is true.
     *
     * @returns True if workspace indexing should occurr, false otherwise.
     */
    private async shouldIndexWorkspace (): Promise<boolean> {
        const shouldIndexWorkspace = (await ConfigurationManager.getConfiguration()).indexWorkspace
        return this.isWorkspaceIndexingSupported && shouldIndexWorkspace
    }
}
