// Copyright 2022 - 2023 The MathWorks, Inc.

import { Range } from 'vscode-languageserver'
import { TextDocument } from 'vscode-languageserver-textdocument'

/**
 * Gets a Range within a text document from the given line/column position to
 * the end of the provided line.
 *
 * @param doc The text document
 * @param line The line number
 * @param char The character number on the line
 * @returns A range
 */
export function getRangeUntilLineEnd (doc: TextDocument, line: number, char: number): Range {
    const lineText = getTextOnLine(doc, line)
    return Range.create(line, char, line, lineText.length)
}

/**
 * Gets the text on the given line of the document.
 *
 * @param doc The text document
 * @param line The line number
 * @returns The text on the line
 */
export function getTextOnLine (doc: TextDocument, line: number): string {
    return doc.getText().split('\n')[line]
}
