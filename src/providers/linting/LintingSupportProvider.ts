// Copyright 2022 - 2024 The MathWorks, Inc.

import { execFile, ExecFileException } from 'child_process'
import { CodeAction, CodeActionKind, CodeActionParams, Command, Diagnostic, DiagnosticSeverity, Position, Range, TextDocumentEdit, TextEdit, VersionedTextDocumentIdentifier, WorkspaceEdit, _Connection } from 'vscode-languageserver'
import { TextDocument } from 'vscode-languageserver-textdocument'
import { URI } from 'vscode-uri'
import ConfigurationManager from '../../lifecycle/ConfigurationManager'
import { MatlabConnection } from '../../lifecycle/MatlabCommunicationManager'
import MatlabLifecycleManager from '../../lifecycle/MatlabLifecycleManager'
import Logger from '../../logging/Logger'
import * as fs from 'fs/promises'
import * as path from 'path'
import which = require('which')
import { MatlabLSCommands } from '../lspCommands/ExecuteCommandProvider'
import { connection } from '../../server'

type mlintSeverity = '0' | '1' | '2' | '3' | '4'

interface RawLintResults {
    lintData: string[]
}

interface DiagnosticSuppressionResults {
    suppressionEdits: TextEdit[]
}

const LINT_DELAY = 500 // Delay (in ms) after keystroke before attempting to lint the document

// Lint result parsing constants
const LINT_MESSAGE_REGEX = /L (\d+) \(C (\d+)-?(\d*)\): ([\dA-Za-z]+): ML(\d): (.*)/
const FIX_FLAG_REGEX = /\(CAN FIX\)/
const FIX_MESSAGE_REGEX = /----FIX MESSAGE<\w+>\s+<([^>]*)>/
const FIX_CHANGE_REGEX = /----CHANGE MESSAGE L (\d+) \(C (\d+)\);\s+L (\d+) \(C (\d+)\):\s+<([^>]*)>/

/**
 * Handles requests for linting-related features.
 * Currently, this handles displaying diagnostics, providing quick-fixes,
 * and suppressing diagnostics.
 *
 * Note: When MATLAB® is not connected, diagnostics are only updated when
 * the file is saved and suppressing warnings is not available.
 */
class LintingSupportProvider {
    private readonly LINTING_REQUEST_CHANNEL = '/matlabls/linting/request'
    private readonly LINTING_RESPONSE_CHANNEL = '/matlabls/linting/response'

    private readonly SUPPRESS_DIAGNOSTIC_REQUEST_CHANNEL = '/matlabls/linting/suppressdiagnostic/request'
    private readonly SUPPRESS_DIAGNOSTIC_RESPONSE_CHANNEL = '/matlabls/linting/suppressdiagnostic/response'

    private readonly SEVERITY_MAP = {
        0: DiagnosticSeverity.Information,
        1: DiagnosticSeverity.Warning,
        2: DiagnosticSeverity.Error,
        3: DiagnosticSeverity.Error,
        4: DiagnosticSeverity.Error
    }

    private readonly _pendingFilesToLint = new Map<string, NodeJS.Timer>()
    private readonly _availableCodeActions = new Map<string, CodeAction[]>()

    /**
     * Queues a document to be linted. This handles debouncing so
     * that linting is not performed on every keystroke.
     *
     * @param textDocument The document to be linted
     * @param connection The language server connection
     */
    queueLintingForDocument (textDocument: TextDocument, connection: _Connection): void {
        const uri = textDocument.uri
        this.clearTimerForDocumentUri(uri)
        this._pendingFilesToLint.set(
            uri,
            setTimeout(() => {
                void this.lintDocument(textDocument, connection)
            }, LINT_DELAY) // Specify timeout for debouncing, to avoid re-linting every keystroke while a user types
        )
    }

    /**
     * Lints the document and displays diagnostics.
     *
     * @param textDocument The document being linted
     * @param connection The language server connection
     */
    async lintDocument (textDocument: TextDocument, connection: _Connection): Promise<void> {
        const uri = textDocument.uri
        this.clearTimerForDocumentUri(uri)
        this.clearCodeActionsForDocumentUri(uri)

        const matlabConnection = MatlabLifecycleManager.getMatlabConnection()
        const isMatlabAvailable = (matlabConnection != null) && MatlabLifecycleManager.isMatlabReady()

        const fileName = URI.parse(uri).fsPath

        let lintData: string[] = []

        if (isMatlabAvailable) {
            // Use MATLAB-based linting for better results and fixes
            const code = textDocument.getText()
            lintData = await this.getLintResultsFromMatlab(code, fileName, matlabConnection)
        } else {
            // Try to use mlint executable for basic linting
            lintData = await this.getLintResultsFromExecutable(fileName)
        }

        const lintResults = this.processLintResults(uri, lintData)
        const diagnostics = lintResults.diagnostics

        // Store code actions
        this._availableCodeActions.set(uri, lintResults.codeActions)

        // Report diagnostics
        void connection.sendDiagnostics({
            uri,
            diagnostics
        })
    }

    clearDiagnosticsForDocument (textDocument: TextDocument): void {
        void connection.sendDiagnostics({
            uri: textDocument.uri,
            diagnostics: []
        })
    }

    /**
     * Handles a request for code actions.
     *
     * @param params Parameters from the onCodeAction request
     */
    handleCodeActionRequest (params: CodeActionParams): CodeAction[] {
        const uri = params.textDocument.uri
        const actions = this._availableCodeActions.get(uri) ?? []

        let codeActions = [...actions]

        // Filter to find unique diagnostics
        codeActions = codeActions.filter(action => {
            const diagnostic = action.diagnostics?.[0]
            if (diagnostic == null) {
                return false
            }
            return params.context.diagnostics.some(diag => this.isSameDiagnostic(diagnostic, diag))
        })

        if (!MatlabLifecycleManager.isMatlabReady()) {
            // Cannot suppress warnings without MATLAB
            return codeActions
        }

        // Add suppression commands
        const diagnostics = params.context.diagnostics
        const commands: Command[] = []
        diagnostics.forEach(diagnostic => {
            // Don't allow suppressing errors
            if (diagnostic.severity === DiagnosticSeverity.Error) {
                return
            }

            const diagnosticCode = diagnostic.code as string

            // Add suppress-on-line option
            commands.push(Command.create(
                `Suppress message ${diagnosticCode} on this line`,
                MatlabLSCommands.MLINT_SUPPRESS_ON_LINE,
                {
                    id: diagnosticCode,
                    range: diagnostic.range,
                    uri
                }
            ))

            // Add suppress-in-file option
            commands.push(Command.create(
                `Suppress message ${diagnosticCode} in this file`,
                MatlabLSCommands.MLINT_SUPPRESS_IN_FILE,
                {
                    id: diagnosticCode,
                    range: diagnostic.range,
                    uri
                }
            ))
        })

        commands.forEach(command => {
            // Add suppression actions as Commands to be processed later.
            codeActions.push(CodeAction.create(command.title, command, CodeActionKind.QuickFix))
        })

        return codeActions
    }

    /**
     * Attempt to suppress a diagnostic.
     *
     * @param textDocument The document
     * @param range The range of the diagnostic being suppress
     * @param id The diagnostic's ID
     * @param shouldSuppressThroughoutFile Whether or not to suppress the diagnostic throughout the entire file
     */
    suppressDiagnostic (textDocument: TextDocument, range: Range, id: string, shouldSuppressThroughoutFile: boolean): void {
        const matlabConnection = MatlabLifecycleManager.getMatlabConnection()
        if (matlabConnection == null || !MatlabLifecycleManager.isMatlabReady()) {
            return
        }

        const responseSub = matlabConnection.subscribe(this.SUPPRESS_DIAGNOSTIC_RESPONSE_CHANNEL, message => {
            matlabConnection.unsubscribe(responseSub)

            const suppressionEdits: TextEdit[] = (message as DiagnosticSuppressionResults).suppressionEdits

            const edit: WorkspaceEdit = {
                changes: {
                    [textDocument.uri]: suppressionEdits
                },
                documentChanges: [
                    TextDocumentEdit.create(
                        VersionedTextDocumentIdentifier.create(textDocument.uri, textDocument.version),
                        suppressionEdits
                    )
                ]
            }

            void connection.workspace.applyEdit(edit)
        })

        matlabConnection.publish(this.SUPPRESS_DIAGNOSTIC_REQUEST_CHANNEL, {
            code: textDocument.getText(),
            diagnosticId: id,
            line: range.start.line + 1,
            suppressInFile: shouldSuppressThroughoutFile
        })
    }

    /**
     * Clears any active linting timers for the provided document URI.
     *
     * @param uri The document URI
     */
    private clearTimerForDocumentUri (uri: string): void {
        const timerId = this._pendingFilesToLint.get(uri)
        if (timerId != null) {
            clearTimeout(timerId)
            this._pendingFilesToLint.delete(uri)
        }
    }

    /**
     * Clears any cached code actions for the provided document URI.
     *
     * @param uri The document URI
     */
    private clearCodeActionsForDocumentUri (uri: string): void {
        this._availableCodeActions.set(uri, [])
    }

    /**
     * Gets raw linting data from MATLAB.
     *
     * @param code The code to be linted
     * @param fileName The file's name
     * @param matlabConnection The connection to MATLAB
     * @returns Raw lint data for the code
     */
    private async getLintResultsFromMatlab (code: string, fileName: string, matlabConnection: MatlabConnection): Promise<string[]> {
        return await new Promise<string[]>(resolve => {
            const responseSub = matlabConnection.subscribe(this.LINTING_RESPONSE_CHANNEL, message => {
                matlabConnection.unsubscribe(responseSub)

                resolve((message as RawLintResults).lintData)
            })

            matlabConnection.publish(this.LINTING_REQUEST_CHANNEL, {
                code,
                fileName
            })
        })
    }

    /**
     * Gets raw linting data using the mlint executable.
     *
     * @param fileName The file's name
     * @returns Raw lint data for the file
     */
    private async getLintResultsFromExecutable (fileName: string): Promise<string[]> {
        const mlintExecutable = await this.getMlintExecutable()

        if (mlintExecutable == null) {
            // Unable to locate executable
            return []
        }

        const mlintArgs = [
            fileName,
            '-id',
            '-severity',
            '-fix'
        ]

        return await new Promise<string[]>(resolve => {
            try {
                execFile(
                    mlintExecutable,
                    mlintArgs,
                    (error: ExecFileException | null, stdout: string, stderr: string) => {
                        if (error != null) {
                            Logger.error(`Error from mlint executable: ${error.message}\n${error.stack ?? ''}`)
                            resolve([])
                        }
                        resolve(stderr.split('\n')) // For some reason, mlint appears to output on stderr instead of stdout
                    }
                )
            } catch (e) {
                Logger.error(`Error executing mlint executable at ${mlintExecutable}`)
            }
        })
    }

    /**
     * Attempts to determine the path to the mlint executable.
     *
     * @returns The path to the mlint executable, or null if it cannot be determined
     */
    private async getMlintExecutable (): Promise<string | null> {
        const platformDirs = this.getBinDirectoriesForPlatform()
        if (platformDirs == null) {
            // Unable to determine platform
            return null
        }

        const matlabInstallPath = (await ConfigurationManager.getConfiguration()).installPath
        let binPath = ''

        if (matlabInstallPath !== '') {
            // Find the executable from the root installation directory
            binPath = path.normalize(path.join(matlabInstallPath, 'bin'))
        } else {
            // Try to find the executable based on the location of the `matlab` executable
            try {
                let resolvedPath = await which('matlab')
                if (resolvedPath !== '') {
                    resolvedPath = await fs.realpath(resolvedPath)
                    binPath = path.dirname(resolvedPath)
                }
            } catch {
                // `matlab` not found on path - no action
            }
        }

        if (binPath === '') {
            return null
        }

        for (const platformDir of platformDirs) {
            const mlintExecutablePath = path.normalize(path.join(
                binPath,
                platformDir,
                process.platform === 'win32' ? 'mlint.exe' : 'mlint'
            ))
            try {
                await fs.access(mlintExecutablePath)
                return mlintExecutablePath // return the first existing path
            } catch {
                // continue to the next iteration
            }
        }

        Logger.error(`Error finding mlint executable in ${binPath}`)

        return null
    }

    /**
     * Gets the name of platform-specific binary directory.
     *
     * @returns The binary directory name, or null if the platform is not recognized
     */
    private getBinDirectoriesForPlatform (): string[] | null {
        switch (process.platform) {
            case 'win32':
                return ['win64']
            case 'darwin':
                return ['maci64', 'maca64']
            case 'linux':
                return ['glnxa64']
            default:
                return null
        }
    }

    /**
     * Parses diagnostics and code actions from the raw lint data.
     *
     * @param uri THe linted document's URI
     * @param lintData The lint data for the document
     * @returns Parsed diagnostics and code actions
     */
    private processLintResults (uri: string, lintData: string[]): { diagnostics: Diagnostic[], codeActions: CodeAction[] } {
        const diagnostics: Diagnostic[] = []
        const codeActions: CodeAction[] = []

        let dataIndex = 0
        while (dataIndex < lintData.length) {
            const message = lintData[dataIndex++]

            if (message === '') {
                continue
            }

            // Parse lint message
            // Diagnostics will be reported with a line like the following:
            //     L {lineNumber} (C {columnNumber}): {diagnosticId}: ML{severity}: {diagnosticMessage} (CAN FIX)
            // If the diagnostic cannot be fixed, the '(CAN FIX)' will not be present
            const parsedLine = message.match(LINT_MESSAGE_REGEX)
            if (parsedLine == null) {
                continue
            }

            const line = Math.max(parseInt(parsedLine[1]) - 1, 0)
            const startColumn = Math.max(parseInt(parsedLine[2]) - 1, 0)
            const endColumn = (parsedLine[3] !== '') ? parseInt(parsedLine[3]) : startColumn + 1 // +1 for open interval
            const id = parsedLine[4]
            const severity = this.SEVERITY_MAP[parsedLine[5] as mlintSeverity]
            let lintMessage: string = parsedLine[6]

            // Check if there are available fixes for this diagnostic
            const fixMatch = lintMessage.match(FIX_FLAG_REGEX)
            if (fixMatch != null) {
                lintMessage = lintMessage.replace(FIX_FLAG_REGEX, '').trim()
            }

            const diagnostic = Diagnostic.create(Range.create(line, startColumn, line, endColumn), lintMessage, severity, id, 'MATLAB')
            diagnostics.push(diagnostic)

            // Parse fix data for this diagnostic, if it exists
            if (fixMatch == null) {
                continue
            }

            const fixInfo = lintData[dataIndex++]

            // Parse fix message
            // Diagnostic fixes will be reported with lines like the following:
            //     ----FIX MESSAGE<{diagnosticFixId}> <{message}>
            //     ----CHANGE MESSAGE L {lineNumber} (C {columnNumber});  L {lineNumber} (C {columnNumber}):  <{text}>
            const fixMsgMatch = fixInfo.match(FIX_MESSAGE_REGEX)
            if (fixMsgMatch == null) {
                continue
            }
            const fixMsg = fixMsgMatch[1]

            // Gather fixes
            const changes = {
                [uri]: [] as TextEdit[]
            }
            const wsEdit: WorkspaceEdit = {
                changes
            }

            while (dataIndex < lintData.length) {
                const actionMsg = lintData[dataIndex]
                const actionMsgMatch = actionMsg.match(FIX_CHANGE_REGEX)
                if (actionMsgMatch == null) {
                    break
                }

                // Consume, since we matched
                dataIndex++

                const startLine = parseInt(actionMsgMatch[1]) - 1
                const startColumn = parseInt(actionMsgMatch[2]) - 1
                const endLine = parseInt(actionMsgMatch[3]) - 1
                const endColumn = parseInt(actionMsgMatch[4])
                const replaceText = actionMsgMatch[5]

                // Translate data into edits
                let edit: TextEdit
                if (startLine === endLine && startColumn === endColumn) {
                    // 1. Insert
                    edit = TextEdit.insert(Position.create(startLine, startColumn + 1), replaceText)
                } else if (replaceText.length === 0) {
                    // 2. Delete
                    edit = TextEdit.del(Range.create(startLine, startColumn, endLine, endColumn))
                } else {
                    // 3. Replace
                    edit = TextEdit.replace(Range.create(startLine, startColumn, endLine, endColumn), replaceText)
                }
                changes[uri].push(edit)
            }

            // If a fix has been processed, create a code action
            if (changes[uri].length > 0) {
                const action = CodeAction.create(fixMsg, wsEdit, CodeActionKind.QuickFix)
                action.diagnostics = [diagnostics[diagnostics.length - 1]]
                codeActions.push(action)
            }
        }

        return {
            diagnostics,
            codeActions
        }
    }

    /**
     * Determines whether two diagnostics are equivalent.
     *
     * @param a The first diagnostic
     * @param b The second diagnostic
     * @returns True if the diagnostics are the same. False otherwise.
     */
    private isSameDiagnostic (a: Diagnostic, b: Diagnostic): boolean {
        return a.code === b.code &&
            a.message === b.message &&
            a.range.start.character === b.range.start.character &&
            a.range.start.line === b.range.start.line &&
            a.range.end.character === b.range.end.character &&
            a.range.end.line === b.range.end.line &&
            a.severity === b.severity &&
            a.source === b.source
    }
}

export default new LintingSupportProvider()
