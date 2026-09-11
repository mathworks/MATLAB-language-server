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

        it('should return null for built-in functions when MATLAB is offline and not connected', async () => {
            sinon.stub(matlabLifecycleManager, 'isMatlabConnected').returns(false)

            const params: HoverParams = {
                textDocument: { uri: 'file:///test.m' },
                position: Position.create(1, 5) // over 'plot'
            }
            const res = await hoverSupportProvider.handleHoverRequest(params, documentManager)

            assert.equal(res, null, 'Result should be null when MATLAB engine is offline')
        })

        it('should return variable definition when hovering over a local variable', async () => {
            sinon.stub(matlabLifecycleManager, 'isMatlabConnected').returns(false)

            const params: HoverParams = {
                textDocument: { uri: 'file:///test.m' },
                position: Position.create(0, 0) // over 'x'
            }
            const res = await hoverSupportProvider.handleHoverRequest(params, documentManager)

            assert.notEqual(res, null, 'Result should not be null for local variable')
            const contents = res?.contents as { kind: string, value: string }
            assert.ok(contents.value.includes('Variable `x`'), 'Should identify variable x')
            assert.ok(contents.value.includes('x = 10;'), 'Should show declaration')
        })

        it('should query MATLAB MVM when connected', async () => {
            sinon.stub(matlabLifecycleManager, 'isMatlabConnected').returns(true)
            mockMvm.isReady.returns(true)
            mockMvm.feval.resolves({
                result: ['Custom help text for stairs']
            })

            const params: HoverParams = {
                textDocument: { uri: 'file:///test.m' },
                position: Position.create(1, 5)
            }
            const res = await hoverSupportProvider.handleHoverRequest(params, documentManager)

            assert.notEqual(res, null)
            const contents = res?.contents as { kind: string, value: string }
            assert.ok(contents.value.includes('Custom help text for stairs'), 'Should contain MVM help text')
        })
    })
})
