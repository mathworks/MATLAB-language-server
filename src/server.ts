// Copyright 2022 - 2023 The MathWorks, Inc.

import { TextDocument } from 'vscode-languageserver-textdocument'
import { ClientCapabilities, createConnection, InitializeParams, InitializeResult, ProposedFeatures, TextDocuments } from 'vscode-languageserver/node'
import DocumentIndexer from './indexing/DocumentIndexer'
import WorkspaceIndexer from './indexing/WorkspaceIndexer'
import ConfigurationManager, { ConnectionTiming } from './lifecycle/ConfigurationManager'
import MatlabLifecycleManager, { MatlabConnectionStatusParam } from './lifecycle/MatlabLifecycleManager'
import Logger from './logging/Logger'
import { Actions, reportTelemetryAction } from './logging/TelemetryUtils'
import NotificationService, { Notification } from './notifications/NotificationService'
import CompletionProvider from './providers/completion/CompletionSupportProvider'
import FormatSupportProvider from './providers/formatting/FormatSupportProvider'
import LintingSupportProvider from './providers/linting/LintingSupportProvider'
import ExecuteCommandProvider, { MatlabLSCommands } from './providers/lspCommands/ExecuteCommandProvider'
import NavigationSupportProvider, { RequestType } from './providers/navigation/NavigationSupportProvider'

// Create a connection for the server
export const connection = createConnection(ProposedFeatures.all)

// Initialize Logger
Logger.initialize(connection.console)

// Create basic text document manager
const documentManager: TextDocuments<TextDocument> = new TextDocuments(TextDocument)

MatlabLifecycleManager.addMatlabLifecycleListener((error, lifecycleEvent) => {
    if (error != null) {
        Logger.error(`MATLAB Lifecycle Error: ${error.message}\n${error.stack ?? ''}`)
    }

    if (lifecycleEvent.matlabStatus === 'connected') {
        // Handle things after MATLAB® has launched

        // Initiate workspace indexing
        void WorkspaceIndexer.indexWorkspace()

        documentManager.all().forEach(textDocument => {
            void LintingSupportProvider.lintDocument(textDocument, connection)
            void DocumentIndexer.indexDocument(textDocument)
        })
    }
})

let capabilities: ClientCapabilities

// Handles an initialization request
connection.onInitialize((params: InitializeParams) => {
    capabilities = params.capabilities

    // Defines the capabilities supported by this language server
    const initResult: InitializeResult = {
        capabilities: {
            codeActionProvider: true,
            completionProvider: {
                triggerCharacters: [
                    '.', // Struct/class properties, package names, etc.
                    '(', // Function call
                    ' ', // Command-style function call
                    ',', // Function arguments
                    '/', // File path
                    '\\' // File path
                ]
            },
            definitionProvider: true,
            documentFormattingProvider: true,
            executeCommandProvider: {
                commands: Object.values(MatlabLSCommands)
            },
            referencesProvider: true,
            signatureHelpProvider: {
                triggerCharacters: ['(', ',']
            }
        }
    }

    return initResult
})

// Handles the initialized notification
connection.onInitialized(() => {
    ConfigurationManager.setup(capabilities)

    WorkspaceIndexer.setupCallbacks(capabilities)

    void startMatlabIfOnStartLaunch()
})

async function startMatlabIfOnStartLaunch (): Promise<void> {
    // Launch MATLAB if it should be launched early
    const connectionTiming = (await ConfigurationManager.getConfiguration()).matlabConnectionTiming
    if (connectionTiming === ConnectionTiming.OnStart) {
        void MatlabLifecycleManager.connectToMatlab(connection)
    }
}

// Handles a shutdown request
connection.onShutdown(() => {
    // Shut down MATLAB
    MatlabLifecycleManager.disconnectFromMatlab()
})

// Set up connection notification listeners
NotificationService.registerNotificationListener(
    Notification.MatlabConnectionClientUpdate,
    data => MatlabLifecycleManager.handleConnectionStatusChange(data as MatlabConnectionStatusParam)
)

// Handles files opened
documentManager.onDidOpen(params => {
    reportFileOpened(params.document)
    void LintingSupportProvider.lintDocument(params.document, connection)
    void DocumentIndexer.indexDocument(params.document)
})

// Handles files saved
documentManager.onDidSave(params => {
    void LintingSupportProvider.lintDocument(params.document, connection)
})

// Handles changes to the text document
documentManager.onDidChangeContent(params => {
    if (MatlabLifecycleManager.isMatlabReady()) {
        // Only want to lint on content changes when linting is being backed by MATLAB
        LintingSupportProvider.queueLintingForDocument(params.document, connection)
        DocumentIndexer.queueIndexingForDocument(params.document)
    }
})

// Handle execute command requests
connection.onExecuteCommand(params => {
    void ExecuteCommandProvider.handleExecuteCommand(params, documentManager, connection)
})

/** -------------------- COMPLETION SUPPORT -------------------- **/
connection.onCompletion(async params => {
    // Gather a list of possible completions to be displayed by the IDE
    return await CompletionProvider.handleCompletionRequest(params, documentManager)
})

connection.onSignatureHelp(async params => {
    // Gather a list of possible function signatures to be displayed by the IDE
    return await CompletionProvider.handleSignatureHelpRequest(params, documentManager)
})

/** -------------------- FORMATTING SUPPORT -------------------- **/
connection.onDocumentFormatting(async params => {
    // Gather a set of document edits required for formatting, which the IDE will execute
    return await FormatSupportProvider.handleDocumentFormatRequest(params, documentManager)
})

/** --------------------  LINTING SUPPORT   -------------------- **/
connection.onCodeAction(params => {
    // Retrieve a list of possible code actions to be displayed by the IDE
    return LintingSupportProvider.handleCodeActionRequest(params)
})

/** --------------------  NAVIGATION SUPPORT   -------------------- **/
connection.onDefinition(async params => {
    return await NavigationSupportProvider.handleDefOrRefRequest(params, documentManager, RequestType.Definition)
})

connection.onReferences(async params => {
    return await NavigationSupportProvider.handleDefOrRefRequest(params, documentManager, RequestType.References)
})

// Start listening to open/change/close text document events
documentManager.listen(connection)

/** -------------------- Helper Functions -------------------- **/
function reportFileOpened(document: TextDocument) {
    const roughSize = Math.ceil(document.getText().length / 1024) // in KB
    reportTelemetryAction(Actions.OpenFile, roughSize.toString())
}
