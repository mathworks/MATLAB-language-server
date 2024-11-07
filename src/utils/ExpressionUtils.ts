// Copyright 2024 The MathWorks, Inc.

import { TextDocument } from 'vscode-languageserver-textdocument'
import { Position } from 'vscode-languageserver'
import { getTextOnLine } from './TextDocumentUtils'

const DOTTED_IDENTIFIER_REGEX = /\b(?:[a-zA-Z][\w]*)(?:\.[a-zA-Z][\w]*)*\b/ // Matches a word followed by optional dotted words

/**
 * Represents a code expression, either a single identifier or a dotted expression.
 * For example, "plot" or "pkg.Class.func".
 */
class Expression {
    constructor (public components: string[], public selectedComponent: number) {}

    /**
     * The full, dotted expression
     */
    get fullExpression (): string {
        return this.components.join('.')
    }

    /**
     * The dotted expression up to and including the selected component
     */
    get targetExpression (): string {
        return this.components.slice(0, this.selectedComponent + 1).join('.')
    }

    /**
     * Only the selected component of the expression
     */
    get unqualifiedTarget (): string {
        return this.components[this.selectedComponent]
    }

    /**
     * The first component of the expression
     */
    get first (): string {
        return this.components[0]
    }

    /**
     * The last component of the expression
     */
    get last (): string {
        return this.components[this.components.length - 1]
    }
}

/**
 * Gets the definition/references request target expression.
 *
 * @param textDocument The text document
 * @param position The position in the document
 * @returns The expression at the given position, or null if no expression is found
 */
export function getExpressionAtPosition (textDocument: TextDocument, position: Position): Expression | null {
    const idAtPosition = getIdentifierAtPosition(textDocument, position)

    if (idAtPosition.identifier === '') {
        return null
    }

    const idComponents = idAtPosition.identifier.split('.')

    // Determine what component was targeted
    let length = 0
    let i = 0
    while (i < idComponents.length && length <= position.character - idAtPosition.start) {
        length += idComponents[i].length + 1 // +1 for '.'
        i++
    }

    return new Expression(idComponents, i - 1) // Compensate for extra increment in loop
}

/**
 * Determines the identifier (or dotted expression) at the given position in the document.
 *
 * @param textDocument The text document
 * @param position The position in the document
 * @returns An object containing the string identifier at the position, as well as the column number at which the identifier starts.
 */
function getIdentifierAtPosition (textDocument: TextDocument, position: Position): { identifier: string, start: number } {
    let lineText = getTextOnLine(textDocument, position.line)

    const result = {
        identifier: '',
        start: -1
    }

    let matchResults = lineText.match(DOTTED_IDENTIFIER_REGEX)
    let offset = 0

    while (matchResults != null) {
        if (matchResults.index == null) {
            // No result found
            break
        }

        const startChar = offset + matchResults.index

        if (startChar > position.character) {
            // Passed the cursor - no match found
            break
        }

        
        if (startChar + matchResults[0].length >= position.character) {
            // Found overlapping identifier
            result.identifier = matchResults[0]
            result.start = startChar
            break
        }

        // Match found too early in line - check for following matches
        lineText = lineText.substring(matchResults.index + matchResults[0].length)
        offset = startChar + matchResults[0].length

        matchResults = lineText.match(DOTTED_IDENTIFIER_REGEX)
    }

    return result
}

export default Expression
