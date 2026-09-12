// Copyright 2026 The MathWorks, Inc.

import { ClientCapabilities } from 'vscode-languageserver'
import Logger from '../logging/Logger'

class ClientCapabilitiesManager {
    private static instance: ClientCapabilitiesManager

    private clientCapabilities: ClientCapabilities | null = null

    public static getInstance (): ClientCapabilitiesManager {
        if (ClientCapabilitiesManager.instance == null) {
            ClientCapabilitiesManager.instance = new ClientCapabilitiesManager()
        }
        return ClientCapabilitiesManager.instance
    }

    /**
     * Stores the client capabilities received during the LSP initialize handshake.
     * Must be called once inside `onInitialize` before any capability checks are made.
     *
     * @param capabilities The client capabilities from InitializeParams
     */
    initialize (capabilities: ClientCapabilities): void {
        this.clientCapabilities = capabilities
    }

    /* -------------------- Feature-Specific Helpers -------------------- */

    /** Whether the client supports `workspace/configuration` requests. */
    hasWorkspaceConfiguration (): boolean {
        return this.getCapabilities()?.workspace?.configuration != null
    }

    /** Whether the client supports dynamic registration of `workspace/didChangeConfiguration`. */
    hasDynamicConfigurationRegistration (): boolean {
        return this.getCapabilities()?.workspace?.didChangeConfiguration?.dynamicRegistration === true
    }

    /** Whether the client supports workspace folders. */
    hasWorkspaceFolders (): boolean {
        return this.getCapabilities()?.workspace?.workspaceFolders === true
    }

    /** Whether the client supports server-initiated `workspace/semanticTokens/refresh` requests. */
    hasSemanticTokensRefresh (): boolean {
        return this.getCapabilities()?.workspace?.semanticTokens?.refreshSupport === true
    }

    /** Whether the client supports workDoneProgress notifications in the status line / UI. */
    hasWorkDoneProgress (): boolean {
        return this.getCapabilities()?.window?.workDoneProgress === true
    }

    /** Private getter which allows for logging a warning if not yet initialized. */
    private getCapabilities (): ClientCapabilities | null {
        if (this.clientCapabilities == null) {
            Logger.warn('Client capabilities requested before initialized')
        }
        return this.clientCapabilities
    }
}

export default ClientCapabilitiesManager.getInstance()
