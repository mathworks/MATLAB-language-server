// Copyright 2026 The MathWorks, Inc.

import { Hover, HoverParams, MarkupKind, Position, Range, TextDocuments } from 'vscode-languageserver'
import { TextDocument } from 'vscode-languageserver-textdocument'
import MatlabLifecycleManager from '../../lifecycle/MatlabLifecycleManager'
import MVM from '../../mvm/impl/MVM'
import Logger from '../../logging/Logger'
import * as fs from 'fs'
import * as path from 'path'
import { URI } from 'vscode-uri'

class HoverSupportProvider {
    constructor (
        private readonly matlabLifecycleManager: MatlabLifecycleManager,
        private readonly mvm: MVM
    ) {}

    /**
     * Handles an incoming textDocument/hover request.
     */
    async handleHoverRequest (params: HoverParams, documentManager: TextDocuments<TextDocument>): Promise<Hover | null> {
        const document = documentManager.get(params.textDocument.uri)
        if (document == null) {
            return null
        }

        const { word, range } = this.getWordAndRangeAtPosition(document, params.position)
        if (word == null || word === '') {
            return null
        }

        // 1. Query MATLAB engine if connected (Online dynamic mode)
        if (this.matlabLifecycleManager.isMatlabConnected() && this.mvm.isReady()) {
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
                                value: `### MATLAB Help: \`${word}\`\n\n\`\`\`matlab\n${helpText}\n\`\`\``
                            },
                            range
                        }
                    }
                }
            } catch (err) {
                Logger.error(`Error querying MATLAB MVM for hover: ${String(err)}`)
            }
        }

        // 2. Check for user-defined function (.m file) in workspace/directory
        const filePath = URI.parse(params.textDocument.uri).fsPath
        const fileDir = path.dirname(filePath)
        const candidateFile = path.join(fileDir, `${word}.m`)

        if (fs.existsSync(candidateFile)) {
            try {
                const fileContent = fs.readFileSync(candidateFile, 'utf-8')
                const docstring = this.extractDocstringFromMFile(fileContent, word)
                if (docstring != null && docstring !== '') {
                    return {
                        contents: {
                            kind: MarkupKind.Markdown,
                            value: docstring
                        },
                        range
                    }
                }
            } catch (err) {
                Logger.error(`Error reading candidate file ${candidateFile}: ${String(err)}`)
            }
        }

        // 3. Check if symbol is a variable defined in the current document
        const varDoc = this.findVariableInDocument(document, word)
        if (varDoc != null && varDoc !== '') {
            return {
                contents: {
                    kind: MarkupKind.Markdown,
                    value: varDoc
                },
                range
            }
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

    /**
     * Extracts function signature and top header comments from a .m file.
     */
    private extractDocstringFromMFile (content: string, funcName: string): string | null {
        const lines = content.split(/\r?\n/)
        let sig = ''
        const comments: string[] = []
        let capturingComments = false

        for (const line of lines) {
            const trimmed = line.trim()
            if (sig === '' && trimmed.startsWith('function')) {
                sig = trimmed
                capturingComments = true
                continue
            }
            if (capturingComments) {
                if (trimmed.startsWith('%')) {
                    comments.push(trimmed.replace(/^%\s?/, ''))
                } else if (trimmed.length > 0) {
                    break
                }
            }
        }

        if (sig === '' && comments.length === 0) {
            return null
        }

        let md = `### Function \`${funcName}\`\n`
        if (sig !== '') {
            md += `\n\`\`\`matlab\n${sig}\n\`\`\`\n`
        }
        if (comments.length > 0) {
            md += `\n${comments.join('\n')}\n`
        }
        return md
    }

    /**
     * Finds the first declaration/assignment of a variable in the current document.
     */
    private findVariableInDocument (document: TextDocument, word: string): string | null {
        const lines = document.getText().split(/\r?\n/)
        const regex = new RegExp(`^\\s*(${word})\\s*=`)

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i]
            if (regex.test(line)) {
                return `### Variable \`${word}\`\n\nDefined at line ${i + 1}:\n\`\`\`matlab\n${line.trim()}\n\`\`\``
            }
        }
        return null
    }
}

export default HoverSupportProvider
