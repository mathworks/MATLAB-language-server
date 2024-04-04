// Copyright 2022 - 2023 The MathWorks, Inc.

import { ExecuteCommandParams, Range, TextDocuments, _Connection } from 'vscode-languageserver'
import { TextDocument } from 'vscode-languageserver-textdocument'
import LintingSupportProvider from '../linting/LintingSupportProvider'

interface LintSuppressionArgs {
    id: string
    range: Range
    uri: string
}

export const MatlabLSCommands = {
    MLINT_SUPPRESS_ON_LINE: 'matlabls.lint.suppress.line',
    MLINT_SUPPRESS_IN_FILE: 'matlabls.lint.suppress.file'
}

/**
 * Handles requests to execute commands
 */
class ExecuteCommandProvider {
    /**
     * Handles command execution requests.
     *
     * @param params Parameters from the onExecuteCommand request
     * @param documentManager The text document manager
     * @param connection The language server connection
     */
    async handleExecuteCommand (params: ExecuteCommandParams, documentManager: TextDocuments<TextDocument>): Promise<void> {
        switch (params.command) {
            case MatlabLSCommands.MLINT_SUPPRESS_ON_LINE:
            case MatlabLSCommands.MLINT_SUPPRESS_IN_FILE:
                void this.handleLintingSuppression(params, documentManager)
        }
    }

    /**
     * Handles command to suppress a linting diagnostic.
     *
     * @param params Parameters from the onExecuteCommand request
     * @param documentManager The text document manager
     * @param connection The language server connection
     */
    private async handleLintingSuppression (params: ExecuteCommandParams, documentManager: TextDocuments<TextDocument>): Promise<void> {
        const args = params.arguments?.[0] as LintSuppressionArgs
        const range = args.range
        const uri = args.uri
        const doc = documentManager.get(uri)

        if (doc == null) {
            return
        }

        const shouldSuppressThroughoutFile = params.command === MatlabLSCommands.MLINT_SUPPRESS_IN_FILE
        void LintingSupportProvider.suppressDiagnostic(doc, range, args.id, shouldSuppressThroughoutFile)
    }
}

export default new ExecuteCommandProvider()
