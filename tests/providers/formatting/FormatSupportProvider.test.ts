// Copyright 2024 - 2025 The MathWorks, Inc.
import assert from 'assert'
import sinon from 'sinon'

import getMockConnection from '../../mocks/Connection.mock'
import getMockMvm from '../../mocks/Mvm.mock'

import FormatSupportProvider from '../../../src/providers/formatting/FormatSupportProvider'
import MatlabLifecycleManager from '../../../src/lifecycle/MatlabLifecycleManager'
import ClientConnection from '../../../src/ClientConnection'

import { TextDocument } from 'vscode-languageserver-textdocument'
import { _Connection, DocumentFormattingParams, DocumentRangeFormattingParams, Range, TextDocuments, TextEdit } from 'vscode-languageserver'

describe('FormatSupportProvider', () => {
    let formatSupportProvider: FormatSupportProvider
    let matlabLifecycleManager: MatlabLifecycleManager
    let documentManager: TextDocuments<TextDocument>
    let mockMvm: any
    let mockTextDocument: TextDocument

    const setup = (documentContents: string) => {
        matlabLifecycleManager = new MatlabLifecycleManager()
        mockMvm = getMockMvm()
        formatSupportProvider = new FormatSupportProvider(matlabLifecycleManager, mockMvm)
        documentManager = new TextDocuments(TextDocument)
        mockTextDocument = TextDocument.create('file:///test.m', 'matlab', 1, documentContents)
        
        sinon.stub(matlabLifecycleManager, 'getMatlabConnection').returns({} as any)
        sinon.stub(documentManager, 'get').returns(mockTextDocument)
    }

    const teardown = () => {
        sinon.restore()
    }

    before(() => {
        ClientConnection._setConnection(getMockConnection())
    })

    after(() => {
        ClientConnection._clearConnection()
    })

    describe('#handleDocumentFormatRequest', () => {
        beforeEach(() => setup('function y = test(x)\ny = x + 1;\nend'))
        afterEach(() => teardown())

        // Because the actual formatting logic occurs in MATLAB, the actual value of these
        // params are not tested in this file. So, define static params for each test.
        const mockParams = {
            textDocument: { uri: 'file:///test.m' },
            options: { insertSpaces: true, tabSize: 4 }
        } as DocumentFormattingParams

        it('should return null if no document to format', async () => {
            // return undefined text document
            (documentManager.get as sinon.SinonStub).returns(undefined)

            const res = await formatSupportProvider.handleDocumentFormatRequest(mockParams, documentManager)

            assert.equal(res, null, 'Result should be null when there is no document')
        })

        it('should return empty array of edits if no formatted code received', async () => {
            sinon.stub(formatSupportProvider as any, 'getFormattedText').returns(null)

            const res = await formatSupportProvider.handleDocumentFormatRequest(mockParams, documentManager)

            assert.deepEqual(res, [], 'Result should be an empty array of edits when no formatted code is received')
        })

        it('should return a single replacement edit for formatted code', async () => {
            const formattedCode = 'if true\n    x = 1;\nend'
            sinon.stub(formatSupportProvider as any, 'getFormattedText').returns(formattedCode)

            const res = await formatSupportProvider.handleDocumentFormatRequest(mockParams, documentManager)

            assert.ok(res instanceof Array, 'Result should be an array')
            assert.ok(res.length === 1, 'Result should contain a single item')
            
            const textEdit = res[0]
            assert.ok(TextEdit.is(textEdit), 'Result should contain a TextEdit')
            assert.deepEqual(textEdit.range, Range.create(0, 0, 2, 3), 'TextEdit should replace the entire document')
            assert.equal(textEdit.newText, formattedCode, 'TextEdit should contain the formatted code')
        })
    })

    describe('#handleDocumentRangeFormatRequest', () => {
        beforeEach(() => setup('if true\nif true\nx = 1;\ny = 2;\nend\nend'))
        afterEach(() => teardown())
        
        // Because the actual formatting logic occurs in MATLAB, the actual value of these
        // params are not tested in this file. So, define static params for each test.
        const mockParams = {
            textDocument: { uri: 'file:///test.m' },
            options: { insertSpaces: true, tabSize: 4 },
            range: Range.create(2, 3, 4, 5)
        } as DocumentRangeFormattingParams

        it('should return null if no document to format', async () => {
            // return undefined text document
            (documentManager.get as sinon.SinonStub).returns(undefined)

            const res = await formatSupportProvider.handleDocumentRangeFormatRequest(mockParams, documentManager)

            assert.equal(res, null, 'Result should be null when there is no document')
        })

        it('should return empty array of edits if no formatted code received', async () => {
            sinon.stub(formatSupportProvider as any, 'getFormattedText').returns(null)

            const res = await formatSupportProvider.handleDocumentRangeFormatRequest(mockParams, documentManager)

            assert.deepEqual(res, [], 'Result should be an empty array of edits when no formatted code is received')
        })

        it('should return a single replacement editor for the formatted lines', async () => {
            const formattedCode = 'if true\nif true\n    x = 1;\n    y = 2;\nend\nend'
            const formattedLines = '    x = 1;\n    y = 2;\nend'
            sinon.stub(formatSupportProvider as any, 'getFormattedText').returns(formattedCode)

            const res = await formatSupportProvider.handleDocumentRangeFormatRequest(mockParams, documentManager)

            assert.ok(res instanceof Array, 'Result should be an array')
            assert.ok(res.length === 1, 'Result should contain a single item')
            
            const textEdit = res[0]
            assert.ok(TextEdit.is(textEdit), 'Result should contain a TextEdit')
            assert.deepEqual(textEdit.range, Range.create(2, 0, 4, 3), 'TextEdit should replace the formatted lines')
            assert.equal(textEdit.newText, formattedLines, 'TextEdit should contain the formatted lines')
        })

        it('should not format the last line if selection ends at first position on line', async () => {
            const mockParams = {
                textDocument: { uri: 'file:///test.m' },
                options: { insertSpaces: true, tabSize: 4 },
                range: Range.create(2, 3, 4, 0)
            } as DocumentRangeFormattingParams

            const formattedCode = 'if true\nif true\n    x = 1;\n    y = 2;\nend\nend'
            const formattedLines = '    x = 1;\n    y = 2;'
            sinon.stub(formatSupportProvider as any, 'getFormattedText').returns(formattedCode)

            const res = await formatSupportProvider.handleDocumentRangeFormatRequest(mockParams, documentManager)

            assert.ok(res instanceof Array, 'Result should be an array')
            assert.ok(res.length === 1, 'Result should contain a single item')
            
            const textEdit = res[0]
            assert.ok(TextEdit.is(textEdit), 'Result should contain a TextEdit')
            assert.deepEqual(textEdit.range, Range.create(2, 0, 3, 6), 'TextEdit should not include line 4')
            assert.equal(textEdit.newText, formattedLines, 'TextEdit should contain the formatted lines')
        })
    })
})
