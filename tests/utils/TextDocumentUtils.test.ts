import assert from "assert";

import * as TextDocumentUtils from '../../src/utils/TextDocumentUtils'
import { TextDocument } from "vscode-languageserver-textdocument";

describe('TextDocumentUtils', () => {
    const testContent = [
        'x = 3;',
        '',
        'y = 2;  ',
        '    plot(x, y)'
    ]
    const docForTesting = TextDocument.create('', '', 1, testContent.join('\n'))

    describe('#getRangeUntilLineEnd', () => {
        it('should return range to end of line', () => {
            // Case 1 - check for range from start of line
            let range = TextDocumentUtils.getRangeUntilLineEnd(docForTesting, 0, 0)
            assert.equal(range.start.line, 0, 'Case 1 - start line should match')
            assert.equal(range.start.character, 0, 'Case 1 - start character should match')
            assert.equal(range.end.line, 0, 'Case 1 - end line should match')
            assert.equal(range.end.character, 6, 'Case 1 - end character should match')

            // Case 2 - check for range from end of line
            range = TextDocumentUtils.getRangeUntilLineEnd(docForTesting, 3, 3)
            assert.equal(range.start.line, 3, 'Case 2 - start line should match')
            assert.equal(range.start.character, 3, 'Case 2 - start character should match')
            assert.equal(range.end.line, 3, 'Case 2 - end line should match')
            assert.equal(range.end.character, 14, 'Case 2 - end character should match')
        })

        it('should return range to end of empty line', () => {
            const range = TextDocumentUtils.getRangeUntilLineEnd(docForTesting, 1, 0)
            assert.equal(range.start.line, 1, 'Start line should match')
            assert.equal(range.start.character, 0, 'Start character should match')
            assert.equal(range.end.line, 1, 'End line should match')
            assert.equal(range.end.character, 0, 'End character should match')
        })

        it('should error on invalid start character number', () => {
            // Case 1 - should throw error for negative character number
            assert.throws(() => {
                TextDocumentUtils.getRangeUntilLineEnd(docForTesting, 1, -1)
            }, 'Should throw error for negative character number')

            // Case 2 - should throw error for character beyond max character number
            assert.throws(() => {
                TextDocumentUtils.getRangeUntilLineEnd(docForTesting, 1, 100)
            }, 'Should throw error for character beyond max character number')
        })
    })

    describe('#getTextOnLine', () => {
        it('should get full text on each line of test content', () => {
            for (let i = 0; i < testContent.length; i++) {
                const text = TextDocumentUtils.getTextOnLine(docForTesting, i)
                assert.equal(text, testContent[i])
            }
        })

        it('should error on invalid line numbers', () => {
            // Case 1 - should throw error for negative line number
            assert.throws(() => {
                TextDocumentUtils.getTextOnLine(docForTesting, -1)
            }, 'Should throw error for line -1')

            // Case 2 - should throw error for line beyond max line number
            assert.throws(() => {
                TextDocumentUtils.getTextOnLine(docForTesting, 10000)
            }, 'Should throw error for line beyond max line number')
        })
    })
})
