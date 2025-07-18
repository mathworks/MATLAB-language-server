// Copyright 2022 - 2025 The MathWorks, Inc.

import { DocumentFormattingParams, DocumentRangeFormattingParams, FormattingOptions, HandlerResult, Position, Range, TextDocuments, TextEdit } from 'vscode-languageserver'
import { TextDocument } from 'vscode-languageserver-textdocument'
import LifecycleNotificationHelper from '../../lifecycle/LifecycleNotificationHelper'
import MatlabLifecycleManager from '../../lifecycle/MatlabLifecycleManager'
import { ActionErrorConditions, Actions, reportTelemetryAction } from '../../logging/TelemetryUtils'
import * as TextDocumentUtils from '../../utils/TextDocumentUtils'
import MVM from '../../mvm/impl/MVM'
import Logger from '../../logging/Logger'
import parse from '../../mvm/MdaParser'

/**
 * Handles requests for format-related features.
 * Currently, this handles formatting the entire document. In the future, this may be expanded to
 * include formatting a range witin the documemt.
 */
class FormatSupportProvider {
    constructor (private readonly matlabLifecycleManager: MatlabLifecycleManager, private readonly mvm: MVM) {}

    /**
     * Handles a request for document formatting.
     *
     * @param params Parameters from the onDocumentFormatting request
     * @param documentManager The text document manager
     * @param connection The language server connection
     * @returns An array of text edits required for the formatting operation, or null if the operation cannot be performed
     */
    async handleDocumentFormatRequest (params: DocumentFormattingParams, documentManager: TextDocuments<TextDocument>): Promise<HandlerResult<TextEdit[] | null | undefined, void>> {
        const docToFormat = documentManager.get(params.textDocument.uri)
        if (docToFormat == null) {
            return null
        }

        return await this.formatDocument(docToFormat, params.options)
    }

    async handleDocumentRangeFormatRequest (params: DocumentRangeFormattingParams, documentManager: TextDocuments<TextDocument>): Promise<TextEdit[] | null> {
        const docToFormat = documentManager.get(params.textDocument.uri)
        if (docToFormat == null) {
            return null
        }

        return await this.formatRange(docToFormat, params.range, params.options)
    }

    /**
     * Determines the edits required to format the given document.
     *
     * @param doc The document being formatted
     * @param options The formatting options
     * @returns An array of text edits required to format the document
     */
    private async formatDocument (doc: TextDocument, options: FormattingOptions): Promise<TextEdit[]> {
        return this.formatWithMatlab(doc, options)
    }

    private async formatRange (doc: TextDocument, range: Range, options: FormattingOptions): Promise<TextEdit[]> {
        return this.formatWithMatlab(doc, options, range)
    }

    private async formatWithMatlab (doc: TextDocument, options: FormattingOptions, formatRange?: Range): Promise<TextEdit[]> {
        const telemetryAction = formatRange ? Actions.FormatDocumentRange : Actions.FormatDocument

        // For formatting, we try to instantiate MATLAB® if it is not already running
        const matlabConnection = await this.matlabLifecycleManager.getMatlabConnection(true)

        // If MATLAB is not available, no-op
        if (matlabConnection == null) {
            LifecycleNotificationHelper.notifyMatlabRequirement();
            reportTelemetryAction(telemetryAction, ActionErrorConditions.MatlabUnavailable);
            return [];
        }

        // As this action may have triggered MATLAB to launch, we may
        // need to wait until the MVM is ready before proceeding
        await this.mvm.waitUntilReady()

        try {
            let startLine = 0
            let endLine = doc.lineCount - 1

            if (formatRange) {
                // Get range to format. If the end position is at character 0 of a line,
                // collapse the range to the previous line.
                startLine = formatRange.start.line
                endLine = formatRange.end.character === 0
                    ? formatRange.end.line - 1
                    : formatRange.end.line
            }

            const formattedText = await this.getFormattedText(doc.getText(), startLine, endLine, options)

            if (formattedText == null) {
                reportTelemetryAction(telemetryAction, 'Error formatting')
                return []
            }

            const textToReplace = formatRange
                ? formattedText.split('\n').slice(startLine, endLine + 1).join('\n')
                : formattedText

            const edit = TextEdit.replace(
                Range.create(
                    Position.create(startLine, 0),
                    TextDocumentUtils.getRangeUntilLineEnd(doc, endLine, 0).end
                ),
                textToReplace
            )

            reportTelemetryAction(telemetryAction)

            return [edit]
        } catch (err) {
            Logger.error(`Error caught while formatting ${formatRange ? 'range' : 'document'}`)
            Logger.error(err as string)
            return []
        }
    }

    private async getFormattedText (unformattedText: string, startLine: number, endLine: number, options: FormattingOptions): Promise<string | null> {
        const requestOpts = {
            insertSpaces: options.insertSpaces,
            tabSize: options.tabSize
        }

        const response = await this.mvm.feval(
                'matlabls.handlers.formatting.formatCode',
                1,
                [unformattedText, startLine, endLine, requestOpts]
            )

        if ('error' in response) {
            // Handle MVMError
            Logger.error('Error received while formatting document:')
            Logger.error(response.error.msg)
            return null
        }

        const formattedText = parse(response.result[0]) as string
        return formattedText
    }
}

export default FormatSupportProvider
