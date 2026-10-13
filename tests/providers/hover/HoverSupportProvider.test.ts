// Copyright 2026 The MathWorks, Inc.
import assert from 'assert'
import sinon from 'sinon'

import getMockConnection from '../../mocks/Connection.mock'
import getMockMvm from '../../mocks/Mvm.mock'

import HoverSupportProvider from '../../../src/providers/hover/HoverSupportProvider'
import MatlabLifecycleManager from '../../../src/lifecycle/MatlabLifecycleManager'
import ClientConnection from '../../../src/ClientConnection'

import { TextDocument } from 'vscode-languageserver-textdocument'
import { HoverParams, Position, TextDocuments } from 'vscode-languageserver'

describe('HoverSupportProvider', () => {
    let hoverSupportProvider: HoverSupportProvider
    let matlabLifecycleManager: MatlabLifecycleManager
    let documentManager: TextDocuments<TextDocument>
    let mockMvm: any
    let mockTextDocument: TextDocument

    const setup = (documentContents: string) => {
        matlabLifecycleManager = new MatlabLifecycleManager()
        mockMvm = getMockMvm()
        hoverSupportProvider = new HoverSupportProvider(matlabLifecycleManager, mockMvm)
        documentManager = new TextDocuments(TextDocument)
        mockTextDocument = TextDocument.create('file:///test.m', 'matlab', 1, documentContents)

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

    describe('#handleHoverRequest', () => {
        beforeEach(() => setup('x = 10;\ny = plot(x);\n'))
        afterEach(() => teardown())

        it('should return null if no document found', async () => {
            (documentManager.get as sinon.SinonStub).returns(undefined)

            const params: HoverParams = {
                textDocument: { uri: 'file:///test.m' },
                position: Position.create(1, 4)
            }
            const res = await hoverSupportProvider.handleHoverRequest(params, documentManager)
            assert.equal(res, null, 'Result should be null when there is no document')
        })

        it('should return null if position is not on a word', async () => {
            const params: HoverParams = {
                textDocument: { uri: 'file:///test.m' },
                position: Position.create(0, 3) // whitespace after '='
            }
            const res = await hoverSupportProvider.handleHoverRequest(params, documentManager)
            assert.equal(res, null, 'Result should be null when hovering on whitespace')
        })

        it('should return null when MATLAB is not connected', async () => {
            sinon.stub(matlabLifecycleManager, 'isMatlabConnected').returns(false)
            mockMvm.isReady.returns(true)

            const params: HoverParams = {
                textDocument: { uri: 'file:///test.m' },
                position: Position.create(1, 5) // over 'plot'
            }
            const res = await hoverSupportProvider.handleHoverRequest(params, documentManager)

            assert.equal(res, null, 'Result should be null when MATLAB engine is not connected')
        })

        it('should return null when MVM is not ready', async () => {
            sinon.stub(matlabLifecycleManager, 'isMatlabConnected').returns(true)
            mockMvm.isReady.returns(false)

            const params: HoverParams = {
                textDocument: { uri: 'file:///test.m' },
                position: Position.create(1, 5) // over 'plot'
            }
            const res = await hoverSupportProvider.handleHoverRequest(params, documentManager)

            assert.equal(res, null, 'Result should be null when MVM is not ready')
        })

        it('should query MATLAB MVM when connected and return formatted markdown', async () => {
            sinon.stub(matlabLifecycleManager, 'isMatlabConnected').returns(true)
            mockMvm.isReady.returns(true)
            mockMvm.feval.resolves({
                result: ['plot - 2-D line plot\n\nSyntax\nplot(X,Y)']
            })

            const params: HoverParams = {
                textDocument: { uri: 'file:///test.m' },
                position: Position.create(1, 5)
            }
            const res = await hoverSupportProvider.handleHoverRequest(params, documentManager)

            assert.notEqual(res, null)
            const contents = res?.contents as { kind: string, value: string }
            assert.ok(contents.value.includes('`plot`'), 'Should contain function name')
            assert.ok(contents.value.includes('2-D line plot'), 'Should contain description')
        })

        it('should return null when MATLAB MVM returns empty help', async () => {
            sinon.stub(matlabLifecycleManager, 'isMatlabConnected').returns(true)
            mockMvm.isReady.returns(true)
            mockMvm.feval.resolves({
                result: ['']
            })

            const params: HoverParams = {
                textDocument: { uri: 'file:///test.m' },
                position: Position.create(1, 5)
            }
            const res = await hoverSupportProvider.handleHoverRequest(params, documentManager)

            assert.equal(res, null, 'Result should be null for empty help')
        })

        it('should return null gracefully when feval throws an error', async () => {
            sinon.stub(matlabLifecycleManager, 'isMatlabConnected').returns(true)
            mockMvm.isReady.returns(true)
            mockMvm.feval.rejects(new Error('MVM error'))

            const params: HoverParams = {
                textDocument: { uri: 'file:///test.m' },
                position: Position.create(1, 5)
            }
            const res = await hoverSupportProvider.handleHoverRequest(params, documentManager)

            assert.equal(res, null, 'Result should be null when MVM throws')
        })
    })
})
