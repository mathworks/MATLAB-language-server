// Copyright 2025 The MathWorks, Inc.

import assert from 'assert'
import sinon from 'sinon'

import ClientConnection from '../../src/ClientConnection'
import getMockConnection from '../mocks/Connection.mock'
import FileInfoIndex, { CodeInfo } from '../../src/indexing/FileInfoIndex'
import { findDefinitions, findReferences, findReferencesAndDefinitions, RequestType } from '../../src/indexing/SymbolSearchService'
import { assertDeepStrictEqualIgnoringOrder } from '../TestUtils'
import PathResolver from '../../src/providers/navigation/PathResolver'
import Indexer from '../../src/indexing/Indexer'
import getMockMvm from '../mocks/Mvm.mock'
import MatlabLifecycleManager from '../../src/lifecycle/MatlabLifecycleManager'

import { Location, Position, Range, TextDocuments, uinteger } from 'vscode-languageserver'
import { TextDocument } from 'vscode-languageserver-textdocument'

interface RefsAndDefsTestCaseInfo {
    caseName: string
    position: Position
    expectedRefs: RangeTuple[]
    expectedDefs: RangeTuple[]
}

describe('SymbolSearchService', () => {
    let mockMvm: any

    let fileInfoIndex: FileInfoIndex
    let documentManager: TextDocuments<TextDocument>
    let pathResolver: PathResolver
    let matlabLifecycleManager: MatlabLifecycleManager
    let indexer: Indexer

    const resourceFilePathPrefix = './rawCodeDataResourceFiles'
    const specCasesResourceFilePathPrefix = `${resourceFilePathPrefix}/improvedCodeAnalysisSpecCases`
    const generalCasesResourceFilePathPrefix = `${specCasesResourceFilePathPrefix}/generalCases`
    const functionCasesResourceFilePathPrefix = `${specCasesResourceFilePathPrefix}/functionCases`
    const classCasesResourceFilePathPrefix = `${specCasesResourceFilePathPrefix}/classCases`
    const shadowingCasesResourceFilePathPrefix = `${specCasesResourceFilePathPrefix}/shadowingCases`
    const dottedIdentifierCasesResourceFilePathPrefix = `${specCasesResourceFilePathPrefix}/dottedIdentifierCases`

    // General cases
    let G_1_rawCodeData: CodeInfo
    let G_2_rawCodeData: CodeInfo
    let G_3_rawCodeData: CodeInfo
    let G_4_rawCodeData: CodeInfo
    let G_5_rawCodeData: CodeInfo
    let G_6_rawCodeData: CodeInfo
    let G_12_rawCodeData: CodeInfo

    // Function cases
    let F_1_rawCodeData: CodeInfo
    let F_2_rawCodeData: CodeInfo
    let F_3_rawCodeData: CodeInfo
    let F_4_rawCodeData: CodeInfo
    let F_5_rawCodeData: CodeInfo
    let F_6_rawCodeData: CodeInfo
    let F_7_rawCodeData: CodeInfo
    let F_8_rawCodeData: CodeInfo
    let F_9_rawCodeData: CodeInfo
    let F_10_rawCodeData: CodeInfo
    let F_11_rawCodeData: CodeInfo
    let F_12_rawCodeData: CodeInfo
    let F_21_rawCodeData: CodeInfo

    // Class cases
    let C_1_rawCodeData: CodeInfo
    let C_2_rawCodeData: CodeInfo
    let C_3_rawCodeData: CodeInfo
    let C_6_rawCodeData: CodeInfo
    let C_7_rawCodeData: CodeInfo
    let C_8_rawCodeData: CodeInfo
    let C_9_rawCodeData: CodeInfo

    // Shadowing cases
    let S_1_rawCodeData: CodeInfo
    let S_8_rawCodeData: CodeInfo

    // Dotted identifier cases
    let D_1_rawCodeData: CodeInfo
    let D_3_rawCodeData: CodeInfo
    let D_4_rawCodeData: CodeInfo
    let D_10_rawCodeData: CodeInfo
    let D_11_rawCodeData: CodeInfo

    before(() => {
        // General cases
        G_1_rawCodeData = require(`${generalCasesResourceFilePathPrefix}/G_1.json`)
        G_2_rawCodeData = require(`${generalCasesResourceFilePathPrefix}/G_2.json`)
        G_3_rawCodeData = require(`${generalCasesResourceFilePathPrefix}/G_3.json`)
        G_4_rawCodeData = require(`${generalCasesResourceFilePathPrefix}/G_4.json`)
        G_5_rawCodeData = require(`${generalCasesResourceFilePathPrefix}/G_5.json`)
        G_6_rawCodeData = require(`${generalCasesResourceFilePathPrefix}/G_6.json`)
        G_12_rawCodeData = require(`${generalCasesResourceFilePathPrefix}/G_12.json`)

        // Function cases
        F_1_rawCodeData = require(`${functionCasesResourceFilePathPrefix}/F_1.json`)
        F_2_rawCodeData = require(`${functionCasesResourceFilePathPrefix}/F_2.json`)
        F_3_rawCodeData = require(`${functionCasesResourceFilePathPrefix}/F_3.json`)
        F_4_rawCodeData = require(`${functionCasesResourceFilePathPrefix}/F_4.json`)
        F_5_rawCodeData = require(`${functionCasesResourceFilePathPrefix}/F_5.json`)
        F_6_rawCodeData = require(`${functionCasesResourceFilePathPrefix}/F_6.json`)
        F_7_rawCodeData = require(`${functionCasesResourceFilePathPrefix}/F_7.json`)
        F_8_rawCodeData = require(`${functionCasesResourceFilePathPrefix}/F_8.json`)
        F_9_rawCodeData = require(`${functionCasesResourceFilePathPrefix}/F_9.json`)
        F_10_rawCodeData = require(`${functionCasesResourceFilePathPrefix}/F_10.json`)
        F_11_rawCodeData = require(`${functionCasesResourceFilePathPrefix}/F_11.json`)
        F_12_rawCodeData = require(`${functionCasesResourceFilePathPrefix}/F_12.json`)
        F_21_rawCodeData = require(`${functionCasesResourceFilePathPrefix}/F_21.json`)

        // Class cases
        C_1_rawCodeData = require(`${classCasesResourceFilePathPrefix}/C_1.json`)
        C_2_rawCodeData = require(`${classCasesResourceFilePathPrefix}/C_2.json`)
        C_3_rawCodeData = require(`${classCasesResourceFilePathPrefix}/C_3.json`)
        C_6_rawCodeData = require(`${classCasesResourceFilePathPrefix}/C_6.json`)
        C_7_rawCodeData = require(`${classCasesResourceFilePathPrefix}/C_7.json`)
        C_8_rawCodeData = require(`${classCasesResourceFilePathPrefix}/C_8.json`)
        C_9_rawCodeData = require(`${classCasesResourceFilePathPrefix}/C_9.json`)

        // Shadowing cases
        S_1_rawCodeData = require(`${shadowingCasesResourceFilePathPrefix}/S_1.json`)
        S_8_rawCodeData = require(`${shadowingCasesResourceFilePathPrefix}/S_8.json`)

        // Dotted identifier cases
        D_1_rawCodeData = require(`${dottedIdentifierCasesResourceFilePathPrefix}/D_1.json`)
        D_3_rawCodeData = require(`${dottedIdentifierCasesResourceFilePathPrefix}/D_3.json`)
        D_4_rawCodeData = require(`${dottedIdentifierCasesResourceFilePathPrefix}/D_4.json`)
        D_10_rawCodeData = require(`${dottedIdentifierCasesResourceFilePathPrefix}/D_10.json`)
        D_11_rawCodeData = require(`${dottedIdentifierCasesResourceFilePathPrefix}/D_11.json`)

        ClientConnection._setConnection(getMockConnection())
    })

    after(() => {
        ClientConnection._clearConnection()
    })

    const setup = () => {
        fileInfoIndex = new FileInfoIndex()

        // General cases
        fileInfoIndex.parseAndStoreCodeInfo('G_1.m', G_1_rawCodeData)
        fileInfoIndex.parseAndStoreCodeInfo('G_2.m', G_2_rawCodeData)
        fileInfoIndex.parseAndStoreCodeInfo('G_3.m', G_3_rawCodeData)
        fileInfoIndex.parseAndStoreCodeInfo('G_4.m', G_4_rawCodeData)
        fileInfoIndex.parseAndStoreCodeInfo('G_5.m', G_5_rawCodeData)
        fileInfoIndex.parseAndStoreCodeInfo('G_6.m', G_6_rawCodeData)
        fileInfoIndex.parseAndStoreCodeInfo('G_12.m', G_12_rawCodeData)

        // Function cases
        fileInfoIndex.parseAndStoreCodeInfo('F_1.m', F_1_rawCodeData)
        fileInfoIndex.parseAndStoreCodeInfo('F_2.m', F_2_rawCodeData)
        fileInfoIndex.parseAndStoreCodeInfo('F_3.m', F_3_rawCodeData)
        fileInfoIndex.parseAndStoreCodeInfo('F_4.m', F_4_rawCodeData)
        fileInfoIndex.parseAndStoreCodeInfo('F_5.m', F_5_rawCodeData)
        fileInfoIndex.parseAndStoreCodeInfo('F_6.m', F_6_rawCodeData)
        fileInfoIndex.parseAndStoreCodeInfo('F_7.m', F_7_rawCodeData)
        fileInfoIndex.parseAndStoreCodeInfo('F_8.m', F_8_rawCodeData)
        fileInfoIndex.parseAndStoreCodeInfo('F_9.m', F_9_rawCodeData)
        fileInfoIndex.parseAndStoreCodeInfo('F_10.m', F_10_rawCodeData)
        fileInfoIndex.parseAndStoreCodeInfo('F_11.m', F_11_rawCodeData)
        fileInfoIndex.parseAndStoreCodeInfo('F_12.m', F_12_rawCodeData)
        fileInfoIndex.parseAndStoreCodeInfo('F_21.m', F_21_rawCodeData)

        // Class cases
        fileInfoIndex.parseAndStoreCodeInfo('C_1.m', C_1_rawCodeData)
        fileInfoIndex.parseAndStoreCodeInfo('C_2.m', C_2_rawCodeData)
        fileInfoIndex.parseAndStoreCodeInfo('C_3.m', C_3_rawCodeData)
        fileInfoIndex.parseAndStoreCodeInfo('C_6.m', C_6_rawCodeData)
        fileInfoIndex.parseAndStoreCodeInfo('C_7.m', C_7_rawCodeData)
        fileInfoIndex.parseAndStoreCodeInfo('C_8.m', C_8_rawCodeData)
        fileInfoIndex.parseAndStoreCodeInfo('C_9.m', C_9_rawCodeData)

        // Shadowing cases
        fileInfoIndex.parseAndStoreCodeInfo('S_1.m', S_1_rawCodeData)
        fileInfoIndex.parseAndStoreCodeInfo('S_8.m', S_8_rawCodeData)

        // Dotted identifier cases
        fileInfoIndex.parseAndStoreCodeInfo('D_1.m', D_1_rawCodeData)
        fileInfoIndex.parseAndStoreCodeInfo('D_3.m', D_3_rawCodeData)
        fileInfoIndex.parseAndStoreCodeInfo('D_4.m', D_4_rawCodeData)
        fileInfoIndex.parseAndStoreCodeInfo('D_10.m', D_10_rawCodeData)
        fileInfoIndex.parseAndStoreCodeInfo('D_11.m', D_11_rawCodeData)

        mockMvm = getMockMvm()

        documentManager = new TextDocuments(TextDocument)
        pathResolver = new PathResolver(mockMvm)
        matlabLifecycleManager = new MatlabLifecycleManager()
        indexer = new Indexer(matlabLifecycleManager, mockMvm, fileInfoIndex)

        const mockTextDocument = TextDocument.create(
            'some_uri', 'matlab', 1, 'abc'
        )
        sinon.stub(documentManager, 'get').returns(mockTextDocument)
    }

    const teardown = () => {
        sinon.restore()
    }

    const refsAndDefsTestCases: RefsAndDefsTestCaseInfo[] = [
        {
            caseName: 'G_1',
            position: Position.create(1, 1),
            expectedRefs: [
                [0, 0, 0, 1],
                [1, 0, 1, 1],
                [2, 4, 2, 5]
            ],
            expectedDefs: [
                [0, 0, 0, 1],
                [1, 0, 1, 1]
            ]
        },
        {
            caseName: 'G_2',
            position: Position.create(0, 2),
            expectedRefs: [
                [0, 0, 0, 3],
                [2, 9, 2, 12],
                [5, 0, 5, 3]
            ],
            expectedDefs: [
                [2, 9, 2, 12]
            ]
        },
        {
            caseName: 'G_3',
            position: Position.create(1, 8),
            expectedRefs: [],
            expectedDefs: []
        },
        {
            caseName: 'G_4',
            position: Position.create(1, 3),
            expectedRefs: [],
            expectedDefs: []
        },
        {
            caseName: 'G_5',
            position: Position.create(2, 1),
            expectedRefs: [],
            expectedDefs: []
        },
        {
            caseName: 'G_6',
            position: Position.create(0, 4),
            expectedRefs: [
                [0, 4, 0, 5],
                [1, 4, 1, 5],
                [1, 8, 1, 9]
            ],
            expectedDefs: [
                [0, 4, 0, 5],
                [1, 4, 1, 5]
            ]
        },
        {
            caseName: 'G_12',
            position: Position.create(1, 6),
            expectedRefs: [
                [0, 5, 0, 6],
                [1, 5, 1, 6]
            ],
            expectedDefs: []
        },
        {
            caseName: 'F_1',
            position: Position.create(0, 11),
            expectedRefs: [
                [0, 9, 0, 12],
                [3, 0, 3, 3]
            ],
            expectedDefs: [
                [0, 9, 0, 12]
            ]
        },
        {
            caseName: 'F_2',
            position: Position.create(3, 8),
            expectedRefs: [
                [1, 4, 1, 5],
                [2, 4, 2, 5],
                [3, 8, 3, 9]
            ],
            expectedDefs: [
                [1, 4, 1, 5],
                [2, 4, 2, 5]
            ]
        },
        {
            caseName: 'F_3',
            position: Position.create(7, 6),
            expectedRefs: [
                [0, 9, 0, 11],
                [4, 0, 4, 2],
                [7, 4, 7, 6]
            ],
            expectedDefs: [
                [0, 9, 0, 11]
            ]
        },
        {
            caseName: 'F_4',
            position: Position.create(4, 5),
            expectedRefs: [
                [4, 4, 4, 5],
                [5, 4, 5, 5],
                [6, 8, 6, 9]
            ],
            expectedDefs: [
                [4, 4, 4, 5],
                [5, 4, 5, 5]
            ]
        },
        {
            caseName: 'F_5',
            position: Position.create(1, 5),
            expectedRefs: [
                [0, 0, 0, 1],
                [1, 4, 1, 5]
            ],
            expectedDefs: [
                [0, 0, 0, 1]
            ]
        },
        {
            caseName: 'F_6',
            position: Position.create(4, 5),
            expectedRefs: [
                [4, 4, 4, 5],
                [6, 13, 6, 14]
            ],
            expectedDefs: [
                [6, 13, 6, 14]
            ]
        },
        {
            caseName: 'F_7',
            position: Position.create(7, 5),
            expectedRefs: [
                [2, 4, 2, 12],
                [7, 4, 7, 12]
            ],
            expectedDefs: []
        },
        {
            caseName: 'F_8',
            position: Position.create(1, 5),
            expectedRefs: [
                [1, 4, 1, 5],
                [2, 9, 2, 10],
                [4, 8, 4, 9],
                [5, 13, 5, 14]
            ],
            expectedDefs: [
                [1, 4, 1, 5],
                [4, 8, 4, 9]
            ]
        },
        {
            caseName: 'F_9',
            position: Position.create(5, 14),
            expectedRefs: [
                [1, 4, 1, 5],
                [2, 9, 2, 10],
                [4, 8, 4, 9],
                [5, 13, 5, 14]
            ],
            expectedDefs: [
                [1, 4, 1, 5],
                [4, 8, 4, 9]
            ]
        },
        {
            caseName: 'F_10',
            position: Position.create(0, 10),
            expectedRefs: [
                [0, 9, 0, 12],
                [1, 4, 1, 7]
            ],
            expectedDefs: [
                [0, 9, 0, 12],
                [1, 4, 1, 7]
            ]
        },
        {
            caseName: 'F_11',
            position: Position.create(3, 16),
            expectedRefs: [
                [2, 26, 2, 28],
                [3, 14, 3, 16]
            ],
            expectedDefs: [
                [2, 26, 2, 28]
            ]
        },
        {
            caseName: 'F_12',
            position: Position.create(0, 21),
            expectedRefs: [
                [0, 9, 0, 12],
                [0, 19, 0, 22],
                [1, 4, 1, 7],
                [1, 10, 1, 13]
            ],
            expectedDefs: [
                [0, 9, 0, 12],
                [0, 19, 0, 22],
                [1, 4, 1, 7]
            ]
        },
        {
            caseName: 'F_21',
            position: Position.create(1, 5),
            expectedRefs: [
                [0, 9, 0, 12],
                [1, 4, 1, 7]
            ],
            expectedDefs: [
                [0, 9, 0, 12],
                [1, 4, 1, 7]
            ]
        },
        {
            caseName: 'C_1',
            position: Position.create(0, 9),
            expectedRefs: [
                [0, 9, 0, 12],
                [6, 23, 6, 26],
                [17, 4, 17, 7],
                [18, 4, 18, 7],
                [19, 4, 19, 7]
            ],
            expectedDefs: [
                [0, 9, 0, 12],
                [6, 23, 6, 26]
            ]
        },
        {
            caseName: 'C_2',
            position: Position.create(0, 20),
            expectedRefs: [
                [0, 15, 0, 25],
                [3, 21, 3, 31],
                [9, 4, 9, 14],
                [10, 4, 10, 14]
            ],
            expectedDefs: []
        },
        {
            caseName: 'C_3',
            position: Position.create(2, 18),
            expectedRefs: [
                [2, 8, 2, 18],
                [10, 21, 10, 31],
                [11, 16, 11, 26]
                // Property access methods not currently supported
            ],
            expectedDefs: [
                [2, 8, 2, 18],
                [11, 16, 11, 26]
            ]
        },
        {
            caseName: 'C_6',
            position: Position.create(6, 24),
            expectedRefs: [
                [0, 9, 0, 12],
                [6, 23, 6, 26],
                [17, 4, 17, 7],
                [18, 4, 18, 7],
                [19, 4, 19, 7]
            ],
            expectedDefs: [
                [0, 9, 0, 12],
                [6, 23, 6, 26]
            ]
        },
        {
            caseName: 'C_7',
            position: Position.create(17, 7),
            expectedRefs: [
                [0, 9, 0, 12],
                [6, 23, 6, 26],
                [17, 4, 17, 7],
                [18, 4, 18, 7],
                [19, 4, 19, 7],
                [20, 4, 20, 7]
            ],
            expectedDefs: [
                [0, 9, 0, 12],
                [6, 23, 6, 26]
            ]
        },
        {
            caseName: 'C_8',
            position: Position.create(3, 14),
            expectedRefs: [
                [3, 12, 3, 15],
                [4, 16, 4, 19],
                [9, 17, 9, 20],
                [10, 12, 10, 15]
            ],
            expectedDefs: [
                [9, 17, 9, 20]
            ]
        },
        {
            caseName: 'C_9',
            position: Position.create(4, 14),
            expectedRefs: [
                [3, 12, 3, 17],
                [4, 12, 4, 17],
                [9, 9, 9, 14],
                [10, 4, 10, 9]
            ],
            expectedDefs: [
                [9, 9, 9, 14]
            ]
        },
        {
            caseName: 'S_1',
            position: Position.create(6, 10),
            expectedRefs: [
                [6, 9, 6, 10],
                [7, 4, 7, 5],
                [8, 9, 8, 10]
            ],
            expectedDefs: [
                [7, 4, 7, 5]
            ]
        },
        {
            caseName: 'S_8',
            position: Position.create(0, 9),
            expectedRefs: [
                [0, 9, 0, 10],
                [7, 0, 7, 1]
            ],
            expectedDefs: [
                [0, 9, 0, 10]
            ]
        },
        {
            caseName: 'D_1',
            position: Position.create(15, 10),
            expectedRefs: [
                [0, 9, 0, 12],
                [6, 17, 6, 20],
                [15, 9, 15, 12],
                [16, 9, 16, 12],
                [17, 9, 17, 12],
                [18, 9, 18, 12]
            ],
            expectedDefs: [
                [0, 9, 0, 12]
            ]
        },
        {
            caseName: 'D_3',
            position: Position.create(8, 25),
            expectedRefs: [
                [3, 21, 3, 29],
                [7, 23, 7, 31],
                [8, 21, 8, 29],
                [9, 17, 9, 25]
            ],
            expectedDefs: [
                [7, 23, 7, 31]
            ]
        },
        {
            caseName: 'D_4',
            position: Position.create(3, 27),
            expectedRefs: [
                [3, 21, 3, 33],
                [14, 17, 14, 29]
            ],
            expectedDefs: [
                [14, 17, 14, 29]
            ]
        },
        {
            caseName: 'D_10',
            position: Position.create(0, 0),
            expectedRefs: [
                [0, 0, 0, 4],
                [1, 0, 1, 4]
            ],
            expectedDefs: []
        },
        {
            caseName: 'D_11',
            position: Position.create(3, 7),
            expectedRefs: [
                [1, 2, 1, 7],
                [3, 7, 3, 12],
                [3, 17, 3, 22],
                [4, 2, 4, 7]
            ],
            expectedDefs: [
                [1, 2, 1, 7],
                [4, 2, 4, 7]
            ]
        }
    ]

    describe('#findReferences', () => {
        beforeEach(() => setup())
        afterEach(() => teardown())

        it('returns no references for a non-indexed file', () => {
            const refs = findReferences(
                'fake.m', Position.create(0, 0), fileInfoIndex, documentManager, RequestType.References
            )

            assert.deepStrictEqual(refs, [])
        })

        it('returns no references for a URI without a document', () => {
            (documentManager.get as sinon.SinonStub).returns(undefined)

            const refs = findReferences(
                'G_1.m', Position.create(1, 1), fileInfoIndex, documentManager, RequestType.References
            )

            assert.deepStrictEqual(refs, [])
        })

        function runFindReferencesTestCase (testCaseInfo: RefsAndDefsTestCaseInfo): void {
            it(`finds correct references for ${testCaseInfo.caseName}`, () => {
                const refs = findReferences(
                    `${testCaseInfo.caseName}.m`, testCaseInfo.position, fileInfoIndex, documentManager,
                    RequestType.References
                )
        
                assertDeepStrictEqualIgnoringOrder(
                    refs,
                    createLocations(`${testCaseInfo.caseName}.m`, testCaseInfo.expectedRefs)
                )
            })
        }

        refsAndDefsTestCases.forEach(runFindReferencesTestCase)
    })

    describe('#findDefinitions', () => {
        beforeEach(() => setup())
        afterEach(() => teardown())

        it('returns no definitions for a non-indexed file', async () => {
            const defs = await findDefinitions(
                'fake.m', Position.create(0, 0), fileInfoIndex, documentManager, pathResolver, indexer,
                RequestType.Definition
            )

            assert.deepStrictEqual(defs, [])
        })

        it('returns no definitions for a URI without a document', async () => {
            (documentManager.get as sinon.SinonStub).returns(undefined)

            const defs = await findDefinitions(
                'G_1.m', Position.create(1, 1), fileInfoIndex, documentManager, pathResolver, indexer,
                RequestType.Definition
            )

            assert.deepStrictEqual(defs, [])
        })

        function runFindDefinitionsTestCase (testCaseInfo: RefsAndDefsTestCaseInfo): void {
            it(`finds correct definitions for ${testCaseInfo.caseName}`, async () => {
                // These test cases will not test for definitions found
                // via the PathResolver (this causes the PathResolver
                // to be unable to find the path for a definition)
                (mockMvm.isReady as sinon.SinonStub).returns(false)

                const defs = await findDefinitions(
                    `${testCaseInfo.caseName}.m`, testCaseInfo.position, fileInfoIndex, documentManager,
                    pathResolver, indexer, RequestType.Definition
                )
        
                assertDeepStrictEqualIgnoringOrder(
                    defs,
                    createLocations(`${testCaseInfo.caseName}.m`, testCaseInfo.expectedDefs)
                )
            })
        }

        refsAndDefsTestCases.forEach(runFindDefinitionsTestCase)
    })

    describe('#findReferencesAndDefinitions', () => {
        beforeEach(() => setup())
        afterEach(() => teardown())

        it('returns no references or definitions for a non-indexed file', () => {
            const refsAndDefs = findReferencesAndDefinitions(
                'fake.m', Position.create(0, 0), fileInfoIndex, documentManager,
                RequestType.DocumentHighlight
            )

            assert.deepStrictEqual(refsAndDefs, {
                references: [],
                definitions: []
            })
        })

        it('returns no references or definitions for a URI without a document', () => {
            (documentManager.get as sinon.SinonStub).returns(undefined)

            const refsAndDefs = findReferencesAndDefinitions(
                'G_1.m', Position.create(1, 1), fileInfoIndex, documentManager,
                RequestType.DocumentHighlight
            )

            assert.deepStrictEqual(refsAndDefs, {
                references: [],
                definitions: []
            })
        })

        function runFindReferencesAndDefinitionsTestCase (testCaseInfo: RefsAndDefsTestCaseInfo): void {
            it(`finds correct references and definitions for ${testCaseInfo.caseName}`, () => {
                const refsAndDefs = findReferencesAndDefinitions(
                    `${testCaseInfo.caseName}.m`, testCaseInfo.position, fileInfoIndex, documentManager,
                    RequestType.DocumentHighlight
                )
        
                assertDeepStrictEqualIgnoringOrder(
                    refsAndDefs.references,
                    createLocations(`${testCaseInfo.caseName}.m`, testCaseInfo.expectedRefs)
                )
                assertDeepStrictEqualIgnoringOrder(
                    refsAndDefs.definitions,
                    createLocations(`${testCaseInfo.caseName}.m`, testCaseInfo.expectedDefs)
                )
            })
        }

        refsAndDefsTestCases.forEach(runFindReferencesAndDefinitionsTestCase)
    })
})

type RangeTuple = [uinteger, uinteger, uinteger, uinteger]

function createLocations (uri: string, rangeTuples: RangeTuple[]): Location[] {
    return rangeTuples.map(rangeTuple => Location.create(
        uri,
        Range.create(rangeTuple[0], rangeTuple[1], rangeTuple[2], rangeTuple[3])
    ))
}
