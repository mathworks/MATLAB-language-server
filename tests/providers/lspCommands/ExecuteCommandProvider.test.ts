// Copyright 2026 The MathWorks, Inc.

import assert from 'assert'
import sinon from 'sinon'
import { TextDocuments } from 'vscode-languageserver'
import { TextDocument } from 'vscode-languageserver-textdocument'
import ExecuteCommandProvider, { MatlabLSCommands } from '../../../src/providers/lspCommands/ExecuteCommandProvider'
import { DocumentationIndexer } from '../../../src/indexing/DocumentationIndexer'
import LintingSupportProvider from '../../../src/providers/linting/LintingSupportProvider'
import MatlabLifecycleManager from '../../../src/lifecycle/MatlabLifecycleManager'
import getMockMvm from '../../mocks/Mvm.mock'

describe('ExecuteCommandProvider', () => {
    let executeCommandProvider: ExecuteCommandProvider
    let lintingSupportProvider: LintingSupportProvider
    let documentationIndexer: DocumentationIndexer
    let documentManager: TextDocuments<TextDocument>

    beforeEach(() => {
        const lifecycleManager = new MatlabLifecycleManager()
        const mockMvm = getMockMvm()
        lintingSupportProvider = new LintingSupportProvider(lifecycleManager, mockMvm)
        documentationIndexer = new DocumentationIndexer()
        executeCommandProvider = new ExecuteCommandProvider(lintingSupportProvider, documentationIndexer)
        documentManager = new TextDocuments(TextDocument)
    })

    afterEach(() => {
        sinon.restore()
    })

    it('should trigger forced documentation indexing when receiving INDEX_DOCUMENTATION command', async () => {
        const startIndexingStub = sinon.stub(documentationIndexer, 'startIndexing').resolves(true)

        await executeCommandProvider.handleExecuteCommand(
            {
                command: MatlabLSCommands.INDEX_DOCUMENTATION,
                arguments: []
            },
            documentManager
        )

        assert.strictEqual(startIndexingStub.calledOnce, true)
        assert.strictEqual(startIndexingStub.firstCall.args[0], true) // force = true
    })
})
