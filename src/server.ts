// Copyright 2022 - 2024 The MathWorks, Inc.

import { TextDocument } from 'vscode-languageserver-textdocument'
import { ClientCapabilities, InitializeParams, InitializeResult, TextDocuments } from 'vscode-languageserver/node'
import DocumentIndexer from './indexing/DocumentIndexer'
import WorkspaceIndexer from './indexing/WorkspaceIndexer'
import ConfigurationManager, { ConnectionTiming } from './lifecycle/ConfigurationManager'
import MatlabLifecycleManager from './lifecycle/MatlabLifecycleManager'
import Logger from './logging/Logger'
import { Actions, reportTelemetryAction } from './logging/TelemetryUtils'
import NotificationService, { Notification } from './notifications/NotificationService'
import CompletionSupportProvider from './providers/completion/CompletionSupportProvider'
import FormatSupportProvider from './providers/formatting/FormatSupportProvider'
import LintingSupportProvider from './providers/linting/LintingSupportProvider'
import ExecuteCommandProvider, { MatlabLSCommands } from './providers/lspCommands/ExecuteCommandProvider'
import NavigationSupportProvider from './providers/navigation/NavigationSupportProvider'
import LifecycleNotificationHelper from './lifecycle/LifecycleNotificationHelper'
import MVM from './mvm/impl/MVM'
import FoldingSupportProvider from './providers/folding/FoldingSupportProvider'
import ClientConnection from './ClientConnection'
import PathResolver from './providers/navigation/PathResolver'
import Indexer from './indexing/Indexer'
import RenameSymbolProvider from './providers/rename/RenameSymbolProvider'
import { RequestType } from './indexing/SymbolSearchService'
import { cacheAndClearProxyEnvironmentVariables } from './utils/ProxyUtils'
import MatlabDebugAdaptorServer from './debug/MatlabDebugAdaptorServer'
import { DebugServices } from './debug/DebugServices'
import MVMServer from './mvm/MVMServer'

import { stopLicensingServer } from './licensing/server'
import { setInstallPath } from './licensing/config'
import { handleInstallPathSettingChanged, handleSignInChanged, setupLicensingNotificationListenersAndUpdateClient } from './utils/LicensingUtils'

export async function startServer (): Promise<void> {
    cacheAndClearProxyEnvironmentVariables()

    // Create a connection for the server
    const connection = ClientConnection.getConnection()

    // Initialize Logger
    Logger.initialize(connection.console)

    // Instantiate services
    const pathResolver = new PathResolver()
    const matlabLifecycleManager = new MatlabLifecycleManager()

    const indexer = new Indexer(matlabLifecycleManager, pathResolver)
    const workspaceIndexer = new WorkspaceIndexer(indexer)
    const documentIndexer = new DocumentIndexer(indexer)

    const formatSupportProvider = new FormatSupportProvider(matlabLifecycleManager)
    const foldingSupportProvider = new FoldingSupportProvider(matlabLifecycleManager)
    const lintingSupportProvider = new LintingSupportProvider(matlabLifecycleManager)
    const executeCommandProvider = new ExecuteCommandProvider(lintingSupportProvider)
    const completionSupportProvider = new CompletionSupportProvider(matlabLifecycleManager)
    const navigationSupportProvider = new NavigationSupportProvider(matlabLifecycleManager, indexer, documentIndexer, pathResolver)
    const renameSymbolProvider = new RenameSymbolProvider(matlabLifecycleManager, documentIndexer)

    // Create basic text document manager
    const documentManager: TextDocuments<TextDocument> = new TextDocuments(TextDocument)

    let mvm: MVM | null
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    let mvmServer: MVMServer | null
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    let matlabDebugAdaptor: MatlabDebugAdaptorServer | null
    let hasMatlabBeenRequested: boolean = false

    matlabLifecycleManager.eventEmitter.on('connected', () => {
        // Handle things after MATLAB® has launched

        hasMatlabBeenRequested = false

        // Initiate workspace indexing
        void workspaceIndexer.indexWorkspace()

        documentManager.all().forEach(textDocument => {
            // Lint the open documents
            void lintingSupportProvider.lintDocument(textDocument)

            // Index the open document
            void documentIndexer.indexDocument(textDocument)
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
                documentSymbolProvider: true,
                renameProvider: {
                    prepareProvider: true
                }
            }
        }

        return initResult
    })

    // Handles the initialized notification
    /* eslint-disable @typescript-eslint/no-explicit-any */
    connection.onInitialized(async () => {
        ConfigurationManager.setup(capabilities)

        // Add callbacks when settings change.
        ConfigurationManager.addSettingCallback('signIn', handleSignInChanged)
        ConfigurationManager.addSettingCallback('installPath', handleInstallPathSettingChanged)

        const configuration = await ConfigurationManager.getConfiguration()

        // If "signIn" setting is checked, setup notification listeners for it.
        if (configuration.signIn) {
            await setupLicensingNotificationListenersAndUpdateClient(matlabLifecycleManager)

            // If installPath setting is not empty, update installPath in licensing config required for its workflows.
            if (configuration.installPath !== '') {
                setInstallPath(configuration.installPath)
            }
        }

        workspaceIndexer.setupCallbacks(capabilities)

        mvm = new MVM(matlabLifecycleManager);
        mvmServer = new MVMServer(mvm, NotificationService);
        matlabDebugAdaptor = new MatlabDebugAdaptorServer(mvm, new DebugServices(mvm));

        void startMatlabIfOnStartLaunch()
    })

    async function startMatlabIfOnStartLaunch (): Promise<void> {
        // Launch MATLAB if it should be launched early
        const connectionTiming = (await ConfigurationManager.getConfiguration()).matlabConnectionTiming
        if (connectionTiming === ConnectionTiming.OnStart) {
            void matlabLifecycleManager.connectToMatlab().catch(reason => {
                // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
                Logger.error(`MATLAB onStart connection failed: ${reason}`)
            })
        }
    }

    // Handles a shutdown request
    connection.onShutdown(async () => {
        // Shut down MATLAB
        matlabLifecycleManager.disconnectFromMatlab()

        // If licensing workflows are enabled, shutdown the licensing server too.
        if ((await ConfigurationManager.getConfiguration()).signIn) {
            stopLicensingServer();
        }
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
                    void matlabLifecycleManager.connectToMatlab().catch(reason => {
                        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
                        Logger.error(`Connection request failed: ${reason}`)
                    })
                    break
                case 'disconnect':
                    matlabLifecycleManager.disconnectFromMatlab()
            }
        }
    )

    // Set up MATLAB startup request listener
    NotificationService.registerNotificationListener(
        Notification.MatlabRequestInstance,
        async () => { // eslint-disable-line @typescript-eslint/no-misused-promises
            if (hasMatlabBeenRequested) {
                return;
            }
            hasMatlabBeenRequested = true;
            const matlabConnection = await matlabLifecycleManager.getMatlabConnection(true);
            if (matlabConnection === null) {
                LifecycleNotificationHelper.notifyMatlabRequirement()
            }
        }
    )

    // Handles files opened
    documentManager.onDidOpen(params => {
        reportFileOpened(params.document)
        void lintingSupportProvider.lintDocument(params.document)
        void documentIndexer.indexDocument(params.document)
    })

    documentManager.onDidClose(params => {
        lintingSupportProvider.clearDiagnosticsForDocument(params.document)
    })

    // Handles files saved
    documentManager.onDidSave(params => {
        void lintingSupportProvider.lintDocument(params.document)
    })

    // Handles changes to the text document
    documentManager.onDidChangeContent(params => {
        if (matlabLifecycleManager.isMatlabConnected()) {
            // Only want to lint on content changes when linting is being backed by MATLAB
            lintingSupportProvider.queueLintingForDocument(params.document)
            documentIndexer.queueIndexingForDocument(params.document)
        }
    })

    // Handle execute command requests
    connection.onExecuteCommand(params => {
        void executeCommandProvider.handleExecuteCommand(params, documentManager)
    })

    /** -------------------- COMPLETION SUPPORT -------------------- **/
    connection.onCompletion(async params => {
        // Gather a list of possible completions to be displayed by the IDE
        return await completionSupportProvider.handleCompletionRequest(params, documentManager)
    })

    connection.onSignatureHelp(async params => {
        // Gather a list of possible function signatures to be displayed by the IDE
        return await completionSupportProvider.handleSignatureHelpRequest(params, documentManager)
    })

    /** -------------------- FOLDING SUPPORT -------------------- **/
    connection.onFoldingRanges(async params => {
        // Retrieve the folding ranges
        // If there are valid folding ranges, hand them back to the IDE
        // Else, return null, so the IDE falls back to indent-based folding
        return await foldingSupportProvider.handleFoldingRangeRequest(params, documentManager)
    })

    /** -------------------- FORMATTING SUPPORT -------------------- **/
    connection.onDocumentFormatting(async params => {
        // Gather a set of document edits required for formatting, which the IDE will execute
        return await formatSupportProvider.handleDocumentFormatRequest(params, documentManager)
    })

    /** --------------------  LINTING SUPPORT   -------------------- **/
    connection.onCodeAction(params => {
        // Retrieve a list of possible code actions to be displayed by the IDE
        return lintingSupportProvider.handleCodeActionRequest(params)
    })

    /** --------------------  NAVIGATION SUPPORT   -------------------- **/
    connection.onDefinition(async params => {
        return await navigationSupportProvider.handleDefOrRefRequest(params, documentManager, RequestType.Definition)
    })

    connection.onReferences(async params => {
        return await navigationSupportProvider.handleDefOrRefRequest(params, documentManager, RequestType.References)
    })

    connection.onDocumentSymbol(async params => {
        return await navigationSupportProvider.handleDocumentSymbol(params, documentManager, RequestType.DocumentSymbol)
    })

    // Start listening to open/change/close text document events
    documentManager.listen(connection)

    /** --------------------  RENAME SUPPORT   -------------------- **/
    connection.onPrepareRename(async params => {
        return await renameSymbolProvider.prepareRename(params, documentManager)
    })

    connection.onRenameRequest(async params => {
        return await renameSymbolProvider.handleRenameRequest(params, documentManager)
    })
}

/** -------------------- Helper Functions -------------------- **/
function reportFileOpened (document: TextDocument): void {
    const roughSize = Math.ceil(document.getText().length / 1024) // in KB
    reportTelemetryAction(Actions.OpenFile, roughSize.toString())
}
