// Copyright 2022 - 2024 The MathWorks, Inc.

import { TextDocument } from 'vscode-languageserver-textdocument'
import { ClientCapabilities, createConnection, InitializeParams, InitializeResult, ProposedFeatures, TextDocuments } from 'vscode-languageserver/node'
import DocumentIndexer from './indexing/DocumentIndexer'
import WorkspaceIndexer from './indexing/WorkspaceIndexer'
import ConfigurationManager, { ConnectionTiming } from './lifecycle/ConfigurationManager'
import MatlabLifecycleManager from './lifecycle/MatlabLifecycleManager'
import Logger from './logging/Logger'
import { Actions, reportTelemetryAction } from './logging/TelemetryUtils'
import NotificationService, { Notification } from './notifications/NotificationService'
import CompletionProvider from './providers/completion/CompletionSupportProvider'
import FormatSupportProvider from './providers/formatting/FormatSupportProvider'
import LintingSupportProvider from './providers/linting/LintingSupportProvider'
import ExecuteCommandProvider, { MatlabLSCommands } from './providers/lspCommands/ExecuteCommandProvider'
import NavigationSupportProvider, { RequestType } from './providers/navigation/NavigationSupportProvider'
import LifecycleNotificationHelper from './lifecycle/LifecycleNotificationHelper'
import MVM from './mvm/MVM'
import FoldingSupportProvider from './providers/folding/FoldingSupportProvider'
import { FoldingRange } from 'vscode-languageserver'

// Create a connection for the server
export const connection = createConnection(ProposedFeatures.all)

// Initialize Logger
Logger.initialize(connection.console)

// Create basic text document manager
const documentManager: TextDocuments<TextDocument> = new TextDocuments(TextDocument)

let mvm: MVM | null

MatlabLifecycleManager.eventEmitter.on('connected', () => {
    // Handle things after MATLAB® has launched

    // Initiate workspace indexing
    void WorkspaceIndexer.indexWorkspace()

    documentManager.all().forEach(textDocument => {
        // Lint the open documents
        void LintingSupportProvider.lintDocument(textDocument)

        // Index the open document
        void DocumentIndexer.indexDocument(textDocument)
    })
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
            foldingRangeProvider: true,
            referencesProvider: true,
            signatureHelpProvider: {
                triggerCharacters: ['(', ',']
            },
            documentSymbolProvider: true
        }
    }

    return initResult
})

// Handles the initialized notification
connection.onInitialized(() => {
    ConfigurationManager.setup(capabilities)

    WorkspaceIndexer.setupCallbacks(capabilities)

    mvm = new MVM(NotificationService, MatlabLifecycleManager);

    void startMatlabIfOnStartLaunch()
})

async function startMatlabIfOnStartLaunch (): Promise<void> {
    // Launch MATLAB if it should be launched early
    const connectionTiming = (await ConfigurationManager.getConfiguration()).matlabConnectionTiming
    if (connectionTiming === ConnectionTiming.OnStart) {
        void MatlabLifecycleManager.connectToMatlab().catch(reason => {
            Logger.error(`MATLAB onStart connection failed: ${reason}`)
        })
    }
}

// Handles a shutdown request
connection.onShutdown(() => {
    // Shut down MATLAB
    MatlabLifecycleManager.disconnectFromMatlab()
})

interface MatlabConnectionStatusParam {
    connectionAction: 'connect' | 'disconnect'
}

// Set up connection notification listeners
NotificationService.registerNotificationListener(
    Notification.MatlabConnectionClientUpdate,
    (data: MatlabConnectionStatusParam) => {
        switch (data.connectionAction) {
            case 'connect':
                void MatlabLifecycleManager.connectToMatlab().catch(reason => {
                    Logger.error(`Connection request failed: ${reason}`)
                })
                break
            case 'disconnect':
                MatlabLifecycleManager.disconnectFromMatlab()
        }
    }
)

// Set up MATLAB startup request listener
NotificationService.registerNotificationListener(
    Notification.MatlabRequestInstance,
    async () => { // eslint-disable-line @typescript-eslint/no-misused-promises
        const matlabConnection = await MatlabLifecycleManager.getMatlabConnection(true);
        if (matlabConnection === null) {
            LifecycleNotificationHelper.notifyMatlabRequirement()
        }
    }
)

// Handles files opened
documentManager.onDidOpen(params => {
    reportFileOpened(params.document)
    void LintingSupportProvider.lintDocument(params.document)
    void DocumentIndexer.indexDocument(params.document)
})

documentManager.onDidClose(params => {
    LintingSupportProvider.clearDiagnosticsForDocument(params.document)
})

// Handles files saved
documentManager.onDidSave(params => {
    void LintingSupportProvider.lintDocument(params.document)
})

// Handles changes to the text document
documentManager.onDidChangeContent(params => {
    if (MatlabLifecycleManager.isMatlabConnected()) {
        // Only want to lint on content changes when linting is being backed by MATLAB
        LintingSupportProvider.queueLintingForDocument(params.document)
        DocumentIndexer.queueIndexingForDocument(params.document)
    }
})

// Handle execute command requests
connection.onExecuteCommand(params => {
    void ExecuteCommandProvider.handleExecuteCommand(params, documentManager)
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

/** -------------------- FOLDING SUPPORT -------------------- **/
connection.onFoldingRanges(async params => {
    // Retrieve the folding ranges
    // If there are valid folding ranges, hand them back to the IDE
    // Else, return null, so the IDE falls back to indent-based folding
    return await FoldingSupportProvider.handleFoldingRangeRequest(params, documentManager)  
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

connection.onDocumentSymbol(async params => {
    return await NavigationSupportProvider.handleDocumentSymbol(params, documentManager, RequestType.DocumentSymbol)
})

// Start listening to open/change/close text document events
documentManager.listen(connection)

/** -------------------- Helper Functions -------------------- **/
function reportFileOpened (document: TextDocument): void {
    const roughSize = Math.ceil(document.getText().length / 1024) // in KB
    reportTelemetryAction(Actions.OpenFile, roughSize.toString())
}
