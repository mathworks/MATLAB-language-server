import assert from 'assert'
import { Position } from 'vscode-languageserver'
import { TextDocument } from 'vscode-languageserver-textdocument'
import * as ExpressionUtils from '../../src/utils/ExpressionUtils'

describe('ExpressionUtils', () => {
    describe('#getExpressionAtPosition', () => {
        it('should return null for empty line', () => {
            const doc = TextDocument.create('', '', 1, '')
            const position = Position.create(0, 0)
            const result = ExpressionUtils.getExpressionAtPosition(doc, position)
            assert.strictEqual(result, null)
        })

        it('should return correct expression for single identifier', () => {
            const doc = TextDocument.create('', '', 1, 'someVariable')
            const position = Position.create(0, 5)
            const result = ExpressionUtils.getExpressionAtPosition(doc, position)
            assert.notStrictEqual(result, null)
            assert.strictEqual(result?.fullExpression, 'someVariable')
            assert.strictEqual(result?.targetExpression, 'someVariable')
            assert.strictEqual(result?.unqualifiedTarget, 'someVariable')
            assert.strictEqual(result?.first, 'someVariable')
            assert.strictEqual(result?.last, 'someVariable')
        })

        it('should return correct expression for dotted identifier', () => {
            const doc = TextDocument.create('', '', 1, 'pkg.Class.method')
            const position = Position.create(0, 7)
            const result = ExpressionUtils.getExpressionAtPosition(doc, position)
            assert.notStrictEqual(result, null)
            assert.strictEqual(result?.fullExpression, 'pkg.Class.method')
            assert.strictEqual(result?.targetExpression, 'pkg.Class')
            assert.strictEqual(result?.unqualifiedTarget, 'Class')
            assert.strictEqual(result?.first, 'pkg')
            assert.strictEqual(result?.last, 'method')
        })

        it('should handle position at the end of identifier', () => {
            const doc = TextDocument.create('', '', 1, 'someVariable')
            const position = Position.create(0, 12)
            const result = ExpressionUtils.getExpressionAtPosition(doc, position)
            assert.notStrictEqual(result, null)
            assert.strictEqual(result?.fullExpression, 'someVariable')
        })

        it('should handle multiple identifiers on the same line', () => {
            const doc = TextDocument.create('', '', 1, 'firstVar secondVar thirdVar')
            const position = Position.create(0, 15)
            const result = ExpressionUtils.getExpressionAtPosition(doc, position)
            assert.notStrictEqual(result, null)
            assert.strictEqual(result?.fullExpression, 'secondVar')
        })

        it('should return null for position between identifiers', () => {
            const doc = TextDocument.create('', '', 1, 'firstVar    secondVar')
            const position = Position.create(0, 10)
            const result = ExpressionUtils.getExpressionAtPosition(doc, position)
            assert.strictEqual(result, null)
        })

        it('should match identifier next to dot operator', () => {
            const doc = TextDocument.create('', '', 1, 'var.^2')
            const position = Position.create(0, 2)
            const result = ExpressionUtils.getExpressionAtPosition(doc, position)
            assert.notStrictEqual(result, null)
            assert.strictEqual(result?.fullExpression, 'var')
        })

        it('should return null for a non-identifier character', () => {
            const doc = TextDocument.create('', '', 1, 'var.@')
            const position = Position.create(0, 4)
            const result = ExpressionUtils.getExpressionAtPosition(doc, position)
            assert.strictEqual(result, null)
        })

        it('should return null for a number', () => {
            const doc = TextDocument.create('', '', 1, '42')
            const position = Position.create(0, 1)
            const result = ExpressionUtils.getExpressionAtPosition(doc, position)
            assert.strictEqual(result, null)
        })
    })
})
