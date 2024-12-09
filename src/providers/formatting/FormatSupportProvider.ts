// Copyright 2022 - 2024 The MathWorks, Inc.

import { DocumentFormattingParams, FormattingOptions, HandlerResult, Position, Range, TextDocuments, TextEdit } from 'vscode-languageserver'
import { TextDocument } from 'vscode-languageserver-textdocument'
import LifecycleNotificationHelper from '../../lifecycle/LifecycleNotificationHelper'
import MatlabLifecycleManager from '../../lifecycle/MatlabLifecycleManager'
import { ActionErrorConditions, Actions, reportTelemetryAction } from '../../logging/TelemetryUtils'
import * as TextDocumentUtils from '../../utils/TextDocumentUtils'

interface FormatDocumentResponse {
    data: string // The formatted document contents
}

/**
 * Handles requests for format-related features.
 * Currently, this handles formatting the entire document. In the future, this may be expanded to
 * include formatting a range witin the documemt.
 */
class FormatSupportProvider {
    readonly REQUEST_CHANNEL = '/matlabls/formatDocument/request'
    readonly RESPONSE_CHANNEL = '/matlabls/formatDocument/response'

    constructor (private readonly matlabLifecycleManager: MatlabLifecycleManager) {}

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

    /**
     * Determines the edits required to format the given document.
     *
     * @param doc The document being formatted
     * @param options The formatting options
     * @returns An array of text edits required to format the document
     */
    private async formatDocument (doc: TextDocument, options: FormattingOptions): Promise<TextEdit[]> {
        // For format, we try to instantiate MATLAB® if it is not already running
        const matlabConnection = await this.matlabLifecycleManager.getMatlabConnection(true)

        // If MATLAB is not available, no-op
        if (matlabConnection == null) {
            LifecycleNotificationHelper.notifyMatlabRequirement()
            reportTelemetryAction(Actions.FormatDocument, ActionErrorConditions.MatlabUnavailable)
            return []
        }

        return await new Promise<TextEdit[]>(resolve => {
            const channelId = matlabConnection.getChannelId()
            const channel = `${this.RESPONSE_CHANNEL}/${channelId}`
            const responseSub = matlabConnection.subscribe(channel, message => {
                matlabConnection.unsubscribe(responseSub)
                const newCode = (message as FormatDocumentResponse).data
                const endRange = TextDocumentUtils.getRangeUntilLineEnd(doc, doc.lineCount - 1, 0)
                const edit = TextEdit.replace(Range.create(
                    Position.create(0, 0),
                    endRange.end
                ), newCode)
                reportTelemetryAction(Actions.FormatDocument)
                resolve([edit])
            })

            matlabConnection.publish(this.REQUEST_CHANNEL, {
                data: doc.getText(),
                insertSpaces: options.insertSpaces,
                tabSize: options.tabSize,
                channelId
            })
        })
    }
}

export default FormatSupportProvider
