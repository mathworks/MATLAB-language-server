// Copyright 2026 The MathWorks, Inc.

import { DocumentHighlight, DocumentHighlightKind, Position, Range } from 'vscode-languageserver'
import { TextDocument } from 'vscode-languageserver-textdocument'
import FileInfoIndex, { ConditionalBlockInfo, MatlabClassInfo, MatlabCodeInfo, MatlabFunctionScopeInfo, MatlabGlobalScopeInfo, NamedRange } from '../../indexing/FileInfoIndex'
import { getTextOnLine } from '../../utils/TextDocumentUtils'

const BLOCK_START_PATTERN = /\b(function|methods|properties|enumeration|events|arguments|classdef)\b/
const BLOCK_END_PATTERN = /\bend\b/

const CONDITIONAL_START_KEYWORDS = /\b(if|for|while|switch|try|parfor|spmd)\b/
const CONDITIONAL_MIDDLE_KEYWORDS = /\b(elseif|else|case|otherwise|catch)\b/

/**
 * Provides document highlights for matching block keywords in MATLAB code.
 *
 * Handles two categories of blocks:
 * - Definition blocks: function, classdef, methods, properties, enumeration, arguments (ranges from mtree indexing)
 * - Conditional blocks: if/for/while/switch/try/parfor/spmd (ranges from tokenizer-based parsing)
 */
class BlockMatchingProvider {
    constructor (private readonly fileInfoIndex: FileInfoIndex) {}

    /**
     * Returns highlights for matching block keywords at the given position,
     * or null if the cursor is not on a block keyword.
     */
    getBlockHighlights (document: TextDocument, position: Position): DocumentHighlight[] | null {
        const codeInfo = this.fileInfoIndex.codeInfoCache.get(document.uri)
        if (codeInfo == null) {
            return null
        }

        const lineText = getTextOnLine(document, position.line)
        const character = position.character

        const conditionalHighlights = this.findConditionalBlockHighlights(position, codeInfo, lineText, character)
        if (conditionalHighlights != null) {
            return conditionalHighlights
        }

        return this.findDefinitionBlockHighlights(document, position, codeInfo, lineText, character)
    }

    /** Highlights matching start/end keywords for function, classdef, methods, and properties blocks. */
    private findDefinitionBlockHighlights (document: TextDocument, position: Position, codeInfo: MatlabCodeInfo, lineText: string, character: number): DocumentHighlight[] | null {
        const isOnStart = this.isCursorOnPattern(lineText, character, BLOCK_START_PATTERN)
        const isOnEnd = this.isCursorOnPattern(lineText, character, BLOCK_END_PATTERN)

        if (!isOnStart && !isOnEnd) {
            return null
        }

        const definitionBlocks = this.getDefinitionBlocks(codeInfo)
        if (definitionBlocks.length === 0) {
            return null
        }

        let matchedBlock: Range | undefined

        if (isOnStart) {
            const candidates = definitionBlocks.filter(b => b.start.line === position.line)
            matchedBlock = candidates.length > 0 ? this.getInnermostBlock(candidates) : undefined
        } else {
            const candidates = definitionBlocks.filter(b =>
                b.end.line === position.line &&
                this.isPositionInBlock(position, b) &&
                this.isCharacterAtBlockEnd(lineText, character, b) &&
                !this.isEndClaimedByConditionalBlock(codeInfo, b)
            )
            matchedBlock = candidates.length > 0 ? this.getInnermostBlock(candidates) : undefined
        }

        if (matchedBlock == null) {
            return null
        }

        if (this.isEndClaimedByConditionalBlock(codeInfo, matchedBlock)) {
            return null
        }

        const startLineText = getTextOnLine(document, matchedBlock.start.line)
        const startRange = this.getKeywordRangeAtPosition(startLineText, matchedBlock.start, BLOCK_START_PATTERN)
        const endLineText = getTextOnLine(document, matchedBlock.end.line)
        const endRange = this.getKeywordRangeAtPosition(endLineText, matchedBlock.end, BLOCK_END_PATTERN)

        if (startRange == null || endRange == null) {
            return null
        }

        return [
            DocumentHighlight.create(startRange, DocumentHighlightKind.Text),
            DocumentHighlight.create(endRange, DocumentHighlightKind.Text)
        ]
    }

    /** Highlights matching start/middle/end keywords for conditional and loop blocks. */
    private findConditionalBlockHighlights (position: Position, codeInfo: MatlabCodeInfo, lineText: string, character: number): DocumentHighlight[] | null {
        const isOnStart = this.isCursorOnPattern(lineText, character, CONDITIONAL_START_KEYWORDS)
        const isOnMiddle = this.isCursorOnPattern(lineText, character, CONDITIONAL_MIDDLE_KEYWORDS)
        const isOnEnd = this.isCursorOnPattern(lineText, character, BLOCK_END_PATTERN)

        if (!isOnStart && !isOnMiddle && !isOnEnd) {
            return null
        }

        const conditionalBlocks = codeInfo.conditionalBlocks
        if (conditionalBlocks.length === 0) {
            return null
        }

        const matchedBlock = this.findMatchingConditionalBlock(conditionalBlocks, position, isOnStart, isOnMiddle, lineText)
        if (matchedBlock == null) {
            return null
        }

        const highlights: DocumentHighlight[] = []
        highlights.push(DocumentHighlight.create(matchedBlock.startKeywordRange, DocumentHighlightKind.Text))
        for (const middleRange of matchedBlock.middleKeywordRanges) {
            highlights.push(DocumentHighlight.create(middleRange, DocumentHighlightKind.Text))
        }
        highlights.push(DocumentHighlight.create(matchedBlock.endKeywordRange, DocumentHighlightKind.Text))

        return highlights
    }

    /** Finds the innermost conditional block whose start, middle, or end keyword is at the cursor position. */
    private findMatchingConditionalBlock (blocks: ConditionalBlockInfo[], position: Position, isOnStart: boolean, isOnMiddle: boolean, lineText: string): ConditionalBlockInfo | undefined {
        const line = position.line
        const character = position.character

        let candidates: ConditionalBlockInfo[]

        if (isOnStart) {
            candidates = blocks.filter(b => this.isPositionInRange(line, character, b.startKeywordRange))
        } else if (isOnMiddle) {
            candidates = blocks.filter(b =>
                b.middleKeywordRanges.some(r => this.isPositionInRange(line, character, r))
            )
        } else {
            candidates = blocks.filter(b =>
                b.endKeywordRange.start.line === line &&
                this.isCharacterAtConditionalBlockEnd(lineText, character, b)
            )
        }

        if (candidates.length === 0) {
            return undefined
        }

        return candidates.reduce((innermost, current) => {
            const innermostSpan = innermost.range.end.line - innermost.range.start.line
            const currentSpan = current.range.end.line - current.range.start.line
            return currentSpan < innermostSpan ? current : innermost
        })
    }

    /** Collects all definition block ranges (functions, classdef, methods, properties) from indexed code info. */
    private getDefinitionBlocks (codeInfo: MatlabCodeInfo): Range[] {
        const blocks: Range[] = []

        this.collectFunctionScopes(codeInfo.globalScopeInfo, blocks)

        const classdef = codeInfo.globalScopeInfo.classScope?.classdefInfo
        if (classdef != null) {
            blocks.push(classdef.range)
            classdef.methodsBlocks.forEach((info: NamedRange) => blocks.push(info.range))
            classdef.propertiesBlocks.forEach((info: NamedRange) => blocks.push(info.range))
            classdef.enumerationsBlocks.forEach((info: NamedRange) => blocks.push(info.range))
            classdef.eventsBlocks.forEach((info: NamedRange) => blocks.push(info.range))
        }

        return blocks
    }

    /** Recursively collects function scope ranges and arguments block ranges from nested scopes. */
    private collectFunctionScopes (scope: MatlabGlobalScopeInfo | MatlabFunctionScopeInfo | MatlabClassInfo, blocks: Range[]): void {
        if (scope instanceof MatlabGlobalScopeInfo && scope.classScope) {
            this.collectFunctionScopes(scope.classScope, blocks)
        }

        for (const functionInfo of scope.functionScopes.values()) {
            const functionScopeInfo = functionInfo.functionScopeInfo
            if (functionScopeInfo) {
                blocks.push(functionScopeInfo.range)
                functionScopeInfo.argumentsBlocks.forEach(range => blocks.push(range))
                this.collectFunctionScopes(functionScopeInfo, blocks)
            }
        }
    }

    private isPositionInRange (line: number, character: number, range: Range): boolean {
        return line === range.start.line &&
            character >= range.start.character &&
            character <= range.end.character
    }

    private isPositionInBlock (position: Position, block: Range): boolean {
        if (position.line < block.start.line || position.line > block.end.line) {
            return false
        }
        if (position.line === block.start.line && position.character < block.start.character) {
            return false
        }
        if (position.line === block.end.line && position.character > block.end.character) {
            return false
        }
        return true
    }

    /** Checks if the definition block's end position falls within any conditional block's end keyword range. */
    private isEndClaimedByConditionalBlock (codeInfo: MatlabCodeInfo, definitionBlock: Range): boolean {
        const endLine = definitionBlock.end.line
        const endChar = definitionBlock.end.character
        return codeInfo.conditionalBlocks.some(cb => {
            const ekr = cb.endKeywordRange
            return ekr.start.line === endLine &&
                endChar >= ekr.start.character &&
                endChar <= ekr.end.character
        })
    }

    /** Checks if the character position corresponds to the specific 'end' keyword that closes this block. */
    private isCharacterAtBlockEnd (lineText: string, character: number, block: Range): boolean {
        const global = new RegExp(BLOCK_END_PATTERN.source, 'g')
        let match: RegExpExecArray | null
        while ((match = global.exec(lineText)) != null) {
            const matchStart = match.index
            const matchEnd = match.index + match[0].length
            if (character >= matchStart && character <= matchEnd &&
                block.end.character >= matchStart && block.end.character <= matchEnd) {
                return true
            }
        }
        return false
    }

    /** Checks if the character position corresponds to the specific 'end' keyword that closes this conditional block. */
    private isCharacterAtConditionalBlockEnd (lineText: string, character: number, block: ConditionalBlockInfo): boolean {
        const global = new RegExp(BLOCK_END_PATTERN.source, 'g')
        let match: RegExpExecArray | null
        while ((match = global.exec(lineText)) != null) {
            const matchStart = match.index
            const matchEnd = match.index + match[0].length
            if (character >= matchStart && character <= matchEnd &&
                block.endKeywordRange.start.character >= matchStart && block.endKeywordRange.start.character <= matchEnd) {
                return true
            }
        }
        return false
    }

    /** Returns the block with the smallest line span (innermost nesting level). */
    private getInnermostBlock (blocks: Range[]): Range {
        return blocks.reduce((innermost, current) => {
            const innermostSpan = innermost.end.line - innermost.start.line
            const currentSpan = current.end.line - current.start.line
            return currentSpan < innermostSpan ? current : innermost
        })
    }

    /** Checks if the cursor position falls within a match of the given pattern on the line. */
    private isCursorOnPattern (lineText: string, character: number, pattern: RegExp): boolean {
        const global = new RegExp(pattern.source, 'g')
        let match: RegExpExecArray | null
        while ((match = global.exec(lineText)) != null) {
            if (character >= match.index && character <= match.index + match[0].length) {
                return true
            }
        }
        return false
    }

    /** Returns the range of the keyword matching the pattern at the given position, or undefined if none. */
    private getKeywordRangeAtPosition (lineText: string, position: Position, pattern: RegExp): Range | undefined {
        const global = new RegExp(pattern.source, 'g')
        let match: RegExpExecArray | null
        while ((match = global.exec(lineText)) != null) {
            if (position.character >= match.index && position.character <= match.index + match[0].length) {
                return Range.create(position.line, match.index, position.line, match.index + match[0].length)
            }
        }
        return undefined
    }
}

export default BlockMatchingProvider
