// // Copyright 2024 The MathWorks, Inc.
// import assert from 'assert'
// import sinon from 'sinon'
//
// import FormatSupportProvider from '../../../src/providers/formatting/FormatSupportProvider'
// import MatlabLifecycleManager from '../../../src/lifecycle/MatlabLifecycleManager'
// import ClientConnection from '../../../src/ClientConnection'
//
// import { TextDocument } from 'vscode-languageserver-textdocument'
// import { _Connection, DocumentFormattingParams, Position, Range, TextDocuments, TextEdit } from 'vscode-languageserver'
// import getMockConnection from '../../mocks/Connection.mock'
//
// describe('FormatSupportProvider', () => {
//     let formatSupportProvider: FormatSupportProvider
//     let matlabLifecycleManager: MatlabLifecycleManager
//     let documentManager: TextDocuments<TextDocument>
//     let mockMatlabConnection: any
//     let mockTextDocument: TextDocument
//
//     before(() => {
//         ClientConnection._setConnection(getMockConnection())
//     })
//
//     after(() => {
//         ClientConnection._clearConnection()
//     })
//
//     describe('#handleDocumentFormatRequest', () => {
//         // Because the actual formatting logic occurs in MATLAB, the actual value of these
//         // params are not tested in this file. So, define static params for each test.
//         const mockParams = {
//             textDocument: { uri: 'file:///test.m' },
//             options: { insertSpaces: true, tabSize: 4 }
//         } as DocumentFormattingParams
//
//         beforeEach(() => {
//             matlabLifecycleManager = new MatlabLifecycleManager()
//             formatSupportProvider = new FormatSupportProvider(matlabLifecycleManager)
//             documentManager = new TextDocuments(TextDocument)
//             mockMatlabConnection = {
//                 getChannelId: sinon.stub().returns('test-channel'),
//                 subscribe: sinon.stub(),
//                 unsubscribe: sinon.stub(),
//                 publish: sinon.stub()
//             }
//             mockTextDocument = TextDocument.create('file:///test.m', 'matlab', 1, 'function y = test(x)\ny = x + 1;\nend')
//
//             sinon.stub(matlabLifecycleManager, 'getMatlabConnection').returns(mockMatlabConnection)
//             sinon.stub(documentManager, 'get').returns(mockTextDocument)
//         })
//
//         afterEach(() => {
//             sinon.restore()
//         })
        //
//         it('should return null if no document to format', async () => {
//             // Return undefined text document
//             (documentManager.get as sinon.SinonStub).returns(undefined)
//
//             const res = await formatSupportProvider.handleDocumentFormatRequest(mockParams, documentManager)
//
//             assert.equal(res, null, 'Result should be null when there is no document')
//         })
//
//         it('should return empty array if no MATLAB connection', async () => {
//             // Return null MATLAB connection
//             (matlabLifecycleManager.getMatlabConnection as sinon.SinonStub).resolves(null)
//
//             const res = await formatSupportProvider.handleDocumentFormatRequest(mockParams, documentManager)
//
//             assert.deepEqual(res, [], 'Result should be [] when there is no connection')
//         })
//
//         it('should handle successful formatting', async () => {
//             const formattedCode = 'function y = test(x)\n    y = x + 1;\nend'
//             const expectedEdit = TextEdit.replace(
//                 Range.create(Position.create(0, 0), Position.create(2, 3)),
//                 formattedCode
//             )
//
//             mockMatlabConnection.subscribe.callsFake((channel: string, callback: any) => {
//                 setTimeout(() => {
//                     callback({ data: formattedCode })
//                 }, 0)
//                 return 'subscription-id'
//             })
//
//             const result = await formatSupportProvider.handleDocumentFormatRequest(mockParams, documentManager)
//
//             assert.deepStrictEqual(result, [expectedEdit])
//             sinon.assert.calledOnce(mockMatlabConnection.publish)
//             sinon.assert.calledWith(mockMatlabConnection.publish, formatSupportProvider.REQUEST_CHANNEL, {
//                 data: mockTextDocument.getText(),
//                 insertSpaces: true,
//                 tabSize: 4,
//                 channelId: 'test-channel'
//             })
//         })
//     })
// })
