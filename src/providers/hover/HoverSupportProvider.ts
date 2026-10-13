// Copyright 2026 The MathWorks, Inc.

import { Hover, HoverParams, MarkupKind, Position, Range, TextDocuments } from 'vscode-languageserver'
import { TextDocument } from 'vscode-languageserver-textdocument'
import MatlabLifecycleManager from '../../lifecycle/MatlabLifecycleManager'
import MVM from '../../mvm/impl/MVM'
import Logger from '../../logging/Logger'
import { formatMatlabHelpToMarkdown } from './HoverMarkdownUtils'

class HoverSupportProvider {
    constructor (
        private readonly matlabLifecycleManager: MatlabLifecycleManager,
        private readonly mvm: MVM
    ) {}

    /**
     * Handles an incoming textDocument/hover request.
     */
    async handleHoverRequest (params: HoverParams, documentManager: TextDocuments<TextDocument>): Promise<Hover | null> {
        if (!this.matlabLifecycleManager.isMatlabConnected() || !this.mvm.isReady()) {
            return null
        }

        const document = documentManager.get(params.textDocument.uri)
        if (document == null) {
            return null
        }

        const { word, range } = this.getWordAndRangeAtPosition(document, params.position)
        if (word == null || word === '') {
            return null
        }

        try {
            const response = await this.mvm.feval(
                'matlabls.handlers.hover.getHover',
                1,
                [word]
            )
            const res = response as { result?: unknown[] } | null
            if (res != null && !('error' in res) && Array.isArray(res.result) && res.result.length > 0) {
                const helpText = String(res.result[0]).trim()
                if (helpText.length > 0) {
                    return {
                        contents: {
                            kind: MarkupKind.Markdown,
                            value: formatMatlabHelpToMarkdown(helpText, word)
                        },
                        range
                    }
                }
            }
        } catch (err) {
            Logger.error(`Error querying MATLAB MVM for hover: ${String(err)}`)
        }

        return null
    }

    /**
     * Extracts word and range at the given position.
     */
    private getWordAndRangeAtPosition (document: TextDocument, position: Position): { word: string | null, range?: Range } {
        const text = document.getText()
        const offset = document.offsetAt(position)

        let start = offset
        while (start > 0 && /[a-zA-Z0-9_]/.test(text[start - 1])) {
            start--
        }

        let end = offset
        while (end < text.length && /[a-zA-Z0-9_]/.test(text[end])) {
            end++
        }

        if (start === end) {
            return { word: null }
        }

        const word = text.substring(start, end)
        const range = Range.create(document.positionAt(start), document.positionAt(end))
        return { word, range }
    }
}

export default HoverSupportProvider
