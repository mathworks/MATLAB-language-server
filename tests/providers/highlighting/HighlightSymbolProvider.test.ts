// Copyright 2025 The MathWorks, Inc.

import assert from 'assert'
import sinon from 'sinon'
import quibble from 'quibble'

import { DocumentHighlight, DocumentHighlightKind, DocumentHighlightParams, DocumentUri, Location, Position, Range, TextDocuments } from 'vscode-languageserver'
import DocumentIndexer from '../../../src/indexing/DocumentIndexer'
import Indexer from '../../../src/indexing/Indexer'
import MatlabLifecycleManager from '../../../src/lifecycle/MatlabLifecycleManager'
import PathResolver from '../../../src/providers/navigation/PathResolver'
import { TextDocument } from 'vscode-languageserver-textdocument'
import getMockMvm from '../../mocks/Mvm.mock'
import ClientConnection from '../../../src/ClientConnection'
import getMockConnection from '../../mocks/Connection.mock'
import SymbolSearchService from '../../../src/indexing/SymbolSearchService'
import Expression from '../../../src/utils/ExpressionUtils'

import type HighlightSymbolProvider from '../../../src/providers/highlighting/HighlightSymbolProvider'
import type { getExpressionAtPosition } from '../../../src/utils/ExpressionUtils'
import { dynamicImport, stubDependency } from '../../TestUtils'

describe('HighlightSymbolProvider', () => {
    const CURRENT_FILE_URI: DocumentUri = 'currentFileUri'
    const OTHER_FILE_URI: DocumentUri = 'otherFileUri'
    
    let mockMvm: any

    let matlabLifecycleManager: MatlabLifecycleManager
    let pathResolver: PathResolver
    let indexer: Indexer
    let documentIndexer: DocumentIndexer

    let highlightSymbolProvider: HighlightSymbolProvider

    let documentManager: TextDocuments<TextDocument>

    let setGetExpressionAtPositionStub: (newStub: typeof getExpressionAtPosition) => void

    const range1 = Range.create(
        Position.create(1, 2),
        Position.create(3, 4)
    )
    const range2 = Range.create(
        Position.create(5, 6),
        Position.create(7, 8)
    )
    const range3 = Range.create(
        Position.create(9, 10),
        Position.create(11, 12)
    )
    const range4 = Range.create(
        Position.create(13, 14),
        Position.create(15, 16)
    )
    const range3To4 = Range.create(
        Position.create(9, 10),
        Position.create(15, 16)
    )

    const locationCurrentFileRange1 = Location.create(
        CURRENT_FILE_URI,
        range1
    )
    const locationCurrentFileRange2 = Location.create(
        CURRENT_FILE_URI,
        range2
    )
    const locationCurrentFileRange3 = Location.create(
        CURRENT_FILE_URI,
        range3
    )
    const locationCurrentFileRange3To4 = Location.create(
        CURRENT_FILE_URI,
        range3To4
    )

    const locationOtherFileRange3 = Location.create(
        OTHER_FILE_URI,
        range3
    )
    const locationOtherFileRange4 = Location.create(
        OTHER_FILE_URI,
        range4
    )

    const setup = () => {
        mockMvm = getMockMvm()
        matlabLifecycleManager = new MatlabLifecycleManager()
        pathResolver = new PathResolver(mockMvm)
        indexer = new Indexer(matlabLifecycleManager, mockMvm, pathResolver)
        documentIndexer = new DocumentIndexer(indexer)

        documentManager = new TextDocuments(TextDocument)

        sinon.stub(matlabLifecycleManager, 'getMatlabConnection').resolves({} as any)
        sinon.stub(documentIndexer, 'ensureDocumentIndexIsUpdated').resolves()

        type ExpressionUtilsExports = typeof import('../../../src/utils/ExpressionUtils')
        const functionToStub: keyof ExpressionUtilsExports = 'getExpressionAtPosition'
        setGetExpressionAtPositionStub = stubDependency<ExpressionUtilsExports, typeof functionToStub>(
            '../../../src/utils/ExpressionUtils',
            functionToStub,
            () => new Expression(['test'], 0)
        )

        type HighlightSymbolProviderExports = typeof import('../../../src/providers/highlighting/HighlightSymbolProvider')
        const { default: HighlightSymbolProvider } = dynamicImport<HighlightSymbolProviderExports>(
            module, '../../../src/providers/highlighting/HighlightSymbolProvider'
        )

        highlightSymbolProvider = new HighlightSymbolProvider(
            matlabLifecycleManager, documentIndexer, pathResolver, indexer
        )

        const mockTextDocument = TextDocument.create(
            CURRENT_FILE_URI, 'matlab', 1, 'abc'
        )
        sinon.stub(documentManager, 'get').returns(mockTextDocument)
    }

    const teardown = () => {
        quibble.reset()
        sinon.restore()
    }

    before(() => {
        ClientConnection._setConnection(getMockConnection())
    })

    after(() => {
        ClientConnection._clearConnection()
    })

    describe('#handleDocumentHighlightRequest', () => {
        beforeEach(() => setup())
        afterEach(() => teardown())

        const mockParams: DocumentHighlightParams = {
            textDocument: {
                uri: CURRENT_FILE_URI
            },
            // values not used
            position: {
                line: 5,
                character: 4
            }
        }

        it('should return null if there is no MATLAB connection', async () => {
            (matlabLifecycleManager.getMatlabConnection as sinon.SinonStub).resolves(null)

            const res = await highlightSymbolProvider.handleDocumentHighlightRequest(
                mockParams, documentManager
            )

            assert.strictEqual(res, null, 'Result should be null when there is no MATLAB connection')
        })

        it('should return empty array of highlights if there is no document at the given URI', async () => {
            (documentManager.get as sinon.SinonStub).returns(undefined)

            const res = await highlightSymbolProvider.handleDocumentHighlightRequest(
                mockParams, documentManager
            )

            assert.deepStrictEqual(res, [], 'Result should be empty when there is no document at the given URI')
        })

        it('should return empty array of highlights if there is no supported expression at the given position', async () => {
            setGetExpressionAtPositionStub(() => null)

            const res = await highlightSymbolProvider.handleDocumentHighlightRequest(
                mockParams, documentManager
            )

            assert.deepStrictEqual(res, [], 'Result should be empty when there is no supported expression at the given position')
        })

        it('should return empty array of highlights if there are no references', async () => {
            sinon.stub(SymbolSearchService, 'findReferences').returns([])
            sinon.stub(SymbolSearchService, 'findDefinitions').resolves([])

            const res = await highlightSymbolProvider.handleDocumentHighlightRequest(
                mockParams, documentManager
            )

            assert.deepStrictEqual(res, [], 'Result should be empty when there are no references to the selected identifier')
        })

        it('should return highlights for references found (in the current file)', async () => {
            sinon.stub(SymbolSearchService, 'findReferences').returns([
                locationCurrentFileRange1,
                locationCurrentFileRange2
            ])
            sinon.stub(SymbolSearchService, 'findDefinitions').resolves([])

            const res = await highlightSymbolProvider.handleDocumentHighlightRequest(
                mockParams, documentManager
            )

            assert.ok(res instanceof Array, 'Result should be an array')

            const highlightRanges: Range[] = res.map(highlight => highlight.range)

            assertDeepStrictEqualToSet(
                highlightRanges, new Set([range1, range2]),
                'Highlight ranges in result should represent the two references found'
            )
        })

        it('should return highlights only for references in the current file', async () => {
            sinon.stub(SymbolSearchService, 'findReferences').returns([
                locationOtherFileRange3,
                locationCurrentFileRange1,
                locationOtherFileRange4,
                locationCurrentFileRange2
            ])
            sinon.stub(SymbolSearchService, 'findDefinitions').resolves([])

            const res = await highlightSymbolProvider.handleDocumentHighlightRequest(
                mockParams, documentManager
            )

            assert.ok(res instanceof Array, 'Result should be an array')

            const highlightRanges: Range[] = res.map(highlight => highlight.range)

            assertDeepStrictEqualToSet(
                highlightRanges, new Set([range1, range2]),
                'Highlight ranges in result should include those from current file, but not those from other file'
            )
        })

        it('should distinguish between write and read references', async () => {
            sinon.stub(SymbolSearchService, 'findReferences').returns([
                locationCurrentFileRange1,
                locationCurrentFileRange2,
                locationCurrentFileRange3
            ])
            sinon.stub(SymbolSearchService, 'findDefinitions').resolves([
                locationCurrentFileRange1,
                locationCurrentFileRange3To4,
            ])

            const res = await highlightSymbolProvider.handleDocumentHighlightRequest(
                mockParams, documentManager
            )

            assert.ok(res instanceof Array, 'Result should be an array')

            assertDeepStrictEqualToSet(
                res,
                new Set([
                    DocumentHighlight.create(range1, DocumentHighlightKind.Write),
                    DocumentHighlight.create(range2, DocumentHighlightKind.Read),
                    DocumentHighlight.create(range3, DocumentHighlightKind.Write)
                ]),
                'Document highlights should be classified as write vs. read based on the definitions found'
            )
        })
    })
})

// Used to check for deep strict equality, ignoring order
function assertDeepStrictEqualToSet<T> (actual: T[], expected: Set<T>, message?: string | Error) {
    assert.ok(actual.length === expected.size, message)
    assert.deepStrictEqual(new Set(actual), expected, message)
}
