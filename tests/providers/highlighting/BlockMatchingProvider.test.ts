// Copyright 2026 The MathWorks, Inc.

import assert from 'assert'
import { DocumentHighlight, DocumentHighlightKind, Position, Range } from 'vscode-languageserver'
import { TextDocument } from 'vscode-languageserver-textdocument'

import BlockMatchingProvider from '../../../src/providers/highlighting/BlockMatchingProvider'
import FileInfoIndex, { ConditionalBlockInfo } from '../../../src/indexing/FileInfoIndex'

describe('BlockMatchingProvider', () => {
    const FILE_URI = 'file:///test.m'

    let fileInfoIndex: FileInfoIndex
    let provider: BlockMatchingProvider

    beforeEach(() => {
        fileInfoIndex = new FileInfoIndex()
        provider = new BlockMatchingProvider(fileInfoIndex)
    })

    function createDocument (content: string): TextDocument {
        return TextDocument.create(FILE_URI, 'matlab', 1, content)
    }

    function setCodeInfo (codeInfo: { conditionalBlocks?: ConditionalBlockInfo[], globalScopeInfo?: any }): void {
        const mockCodeInfo = {
            conditionalBlocks: codeInfo.conditionalBlocks ?? [],
            globalScopeInfo: codeInfo.globalScopeInfo ?? {
                classScope: undefined,
                functionScopes: new Map()
            }
        }
        fileInfoIndex.codeInfoCache.set(FILE_URI, mockCodeInfo as any)
    }

    function makeConditionalBlock (
        range: Range,
        startKeywordRange: Range,
        endKeywordRange: Range,
        middleKeywordRanges: Range[] = []
    ): ConditionalBlockInfo {
        return { range, startKeywordRange, endKeywordRange, middleKeywordRanges }
    }

    describe('#getBlockHighlights', () => {
        it('should return null when no code info is cached for the document', () => {
            const document = createDocument('function foo\nend')
            const result = provider.getBlockHighlights(document, Position.create(0, 0))
            assert.strictEqual(result, null)
        })

        it('should return null when cursor is not on any block keyword', () => {
            const document = createDocument('x = 5')
            setCodeInfo({})

            const result = provider.getBlockHighlights(document, Position.create(0, 2))
            assert.strictEqual(result, null)
        })

        it('should return null when cursor is on a keyword-like substring inside an identifier', () => {
            const document = createDocument('perform = 1')
            setCodeInfo({})

            const result = provider.getBlockHighlights(document, Position.create(0, 4))
            assert.strictEqual(result, null)
        })
    })

    describe('conditional block highlighting', () => {
        it('should highlight if/end block when cursor is on if', () => {
            const content = 'if x > 0\n    y = 1\nend'
            const document = createDocument(content)

            const block = makeConditionalBlock(
                Range.create(0, 0, 2, 3),
                Range.create(0, 0, 0, 2),
                Range.create(2, 0, 2, 3)
            )
            setCodeInfo({ conditionalBlocks: [block] })

            const result = provider.getBlockHighlights(document, Position.create(0, 0))

            assert.ok(result != null)
            assert.strictEqual(result.length, 2)
            assert.deepStrictEqual(result[0], DocumentHighlight.create(Range.create(0, 0, 0, 2), DocumentHighlightKind.Text))
            assert.deepStrictEqual(result[1], DocumentHighlight.create(Range.create(2, 0, 2, 3), DocumentHighlightKind.Text))
        })

        it('should highlight if/end block when cursor is on end', () => {
            const content = 'if x > 0\n    y = 1\nend'
            const document = createDocument(content)

            const block = makeConditionalBlock(
                Range.create(0, 0, 2, 3),
                Range.create(0, 0, 0, 2),
                Range.create(2, 0, 2, 3)
            )
            setCodeInfo({ conditionalBlocks: [block] })

            const result = provider.getBlockHighlights(document, Position.create(2, 1))

            assert.ok(result != null)
            assert.strictEqual(result.length, 2)
            assert.deepStrictEqual(result[0], DocumentHighlight.create(Range.create(0, 0, 0, 2), DocumentHighlightKind.Text))
            assert.deepStrictEqual(result[1], DocumentHighlight.create(Range.create(2, 0, 2, 3), DocumentHighlightKind.Text))
        })

        it('should highlight if/elseif/else/end block with middle keywords', () => {
            const content = 'if x > 0\n    y = 1\nelseif x < 0\n    y = -1\nelse\n    y = 0\nend'
            const document = createDocument(content)

            const block = makeConditionalBlock(
                Range.create(0, 0, 6, 3),
                Range.create(0, 0, 0, 2),
                Range.create(6, 0, 6, 3),
                [Range.create(2, 0, 2, 6), Range.create(4, 0, 4, 4)]
            )
            setCodeInfo({ conditionalBlocks: [block] })

            const result = provider.getBlockHighlights(document, Position.create(2, 3))

            assert.ok(result != null)
            assert.strictEqual(result.length, 4)
            assert.deepStrictEqual(result[0], DocumentHighlight.create(Range.create(0, 0, 0, 2), DocumentHighlightKind.Text))
            assert.deepStrictEqual(result[1], DocumentHighlight.create(Range.create(2, 0, 2, 6), DocumentHighlightKind.Text))
            assert.deepStrictEqual(result[2], DocumentHighlight.create(Range.create(4, 0, 4, 4), DocumentHighlightKind.Text))
            assert.deepStrictEqual(result[3], DocumentHighlight.create(Range.create(6, 0, 6, 3), DocumentHighlightKind.Text))
        })

        it('should highlight for/end block', () => {
            const content = 'for i = 1:10\n    x = i\nend'
            const document = createDocument(content)

            const block = makeConditionalBlock(
                Range.create(0, 0, 2, 3),
                Range.create(0, 0, 0, 3),
                Range.create(2, 0, 2, 3)
            )
            setCodeInfo({ conditionalBlocks: [block] })

            const result = provider.getBlockHighlights(document, Position.create(0, 1))

            assert.ok(result != null)
            assert.strictEqual(result.length, 2)
            assert.deepStrictEqual(result[0], DocumentHighlight.create(Range.create(0, 0, 0, 3), DocumentHighlightKind.Text))
            assert.deepStrictEqual(result[1], DocumentHighlight.create(Range.create(2, 0, 2, 3), DocumentHighlightKind.Text))
        })

        it('should highlight while/end block', () => {
            const content = 'while x > 0\n    x = x - 1\nend'
            const document = createDocument(content)

            const block = makeConditionalBlock(
                Range.create(0, 0, 2, 3),
                Range.create(0, 0, 0, 5),
                Range.create(2, 0, 2, 3)
            )
            setCodeInfo({ conditionalBlocks: [block] })

            const result = provider.getBlockHighlights(document, Position.create(0, 2))

            assert.ok(result != null)
            assert.strictEqual(result.length, 2)
            assert.deepStrictEqual(result[0], DocumentHighlight.create(Range.create(0, 0, 0, 5), DocumentHighlightKind.Text))
            assert.deepStrictEqual(result[1], DocumentHighlight.create(Range.create(2, 0, 2, 3), DocumentHighlightKind.Text))
        })

        it('should highlight switch/case/otherwise/end block', () => {
            const content = 'switch x\n    case 1\n        y = 1\n    otherwise\n        y = 0\nend'
            const document = createDocument(content)

            const block = makeConditionalBlock(
                Range.create(0, 0, 5, 3),
                Range.create(0, 0, 0, 6),
                Range.create(5, 0, 5, 3),
                [Range.create(1, 4, 1, 8), Range.create(3, 4, 3, 13)]
            )
            setCodeInfo({ conditionalBlocks: [block] })

            const result = provider.getBlockHighlights(document, Position.create(3, 6))

            assert.ok(result != null)
            assert.strictEqual(result.length, 4)
            assert.deepStrictEqual(result[0], DocumentHighlight.create(Range.create(0, 0, 0, 6), DocumentHighlightKind.Text))
            assert.deepStrictEqual(result[1], DocumentHighlight.create(Range.create(1, 4, 1, 8), DocumentHighlightKind.Text))
            assert.deepStrictEqual(result[2], DocumentHighlight.create(Range.create(3, 4, 3, 13), DocumentHighlightKind.Text))
            assert.deepStrictEqual(result[3], DocumentHighlight.create(Range.create(5, 0, 5, 3), DocumentHighlightKind.Text))
        })

        it('should highlight try/catch/end block', () => {
            const content = 'try\n    x = 1\ncatch e\n    x = 0\nend'
            const document = createDocument(content)

            const block = makeConditionalBlock(
                Range.create(0, 0, 4, 3),
                Range.create(0, 0, 0, 3),
                Range.create(4, 0, 4, 3),
                [Range.create(2, 0, 2, 5)]
            )
            setCodeInfo({ conditionalBlocks: [block] })

            const result = provider.getBlockHighlights(document, Position.create(2, 2))

            assert.ok(result != null)
            assert.strictEqual(result.length, 3)
            assert.deepStrictEqual(result[0], DocumentHighlight.create(Range.create(0, 0, 0, 3), DocumentHighlightKind.Text))
            assert.deepStrictEqual(result[1], DocumentHighlight.create(Range.create(2, 0, 2, 5), DocumentHighlightKind.Text))
            assert.deepStrictEqual(result[2], DocumentHighlight.create(Range.create(4, 0, 4, 3), DocumentHighlightKind.Text))
        })

        it('should highlight parfor/end block', () => {
            const content = 'parfor i = 1:10\n    x(i) = i\nend'
            const document = createDocument(content)

            const block = makeConditionalBlock(
                Range.create(0, 0, 2, 3),
                Range.create(0, 0, 0, 6),
                Range.create(2, 0, 2, 3)
            )
            setCodeInfo({ conditionalBlocks: [block] })

            const result = provider.getBlockHighlights(document, Position.create(0, 3))

            assert.ok(result != null)
            assert.strictEqual(result.length, 2)
            assert.deepStrictEqual(result[0], DocumentHighlight.create(Range.create(0, 0, 0, 6), DocumentHighlightKind.Text))
            assert.deepStrictEqual(result[1], DocumentHighlight.create(Range.create(2, 0, 2, 3), DocumentHighlightKind.Text))
        })

        it('should highlight spmd/end block', () => {
            const content = 'spmd\n    x = labindex\nend'
            const document = createDocument(content)

            const block = makeConditionalBlock(
                Range.create(0, 0, 2, 3),
                Range.create(0, 0, 0, 4),
                Range.create(2, 0, 2, 3)
            )
            setCodeInfo({ conditionalBlocks: [block] })

            const result = provider.getBlockHighlights(document, Position.create(0, 2))

            assert.ok(result != null)
            assert.strictEqual(result.length, 2)
            assert.deepStrictEqual(result[0], DocumentHighlight.create(Range.create(0, 0, 0, 4), DocumentHighlightKind.Text))
            assert.deepStrictEqual(result[1], DocumentHighlight.create(Range.create(2, 0, 2, 3), DocumentHighlightKind.Text))
        })

        it('should select innermost block for nested conditional blocks', () => {
            const content = 'if a\n    if b\n        x = 1\n    end\nend'
            const document = createDocument(content)

            const outerBlock = makeConditionalBlock(
                Range.create(0, 0, 4, 3),
                Range.create(0, 0, 0, 2),
                Range.create(4, 0, 4, 3)
            )
            const innerBlock = makeConditionalBlock(
                Range.create(1, 4, 3, 7),
                Range.create(1, 4, 1, 6),
                Range.create(3, 4, 3, 7)
            )
            setCodeInfo({ conditionalBlocks: [outerBlock, innerBlock] })

            const result = provider.getBlockHighlights(document, Position.create(1, 5))

            assert.ok(result != null)
            assert.strictEqual(result.length, 2)
            assert.deepStrictEqual(result[0], DocumentHighlight.create(Range.create(1, 4, 1, 6), DocumentHighlightKind.Text))
            assert.deepStrictEqual(result[1], DocumentHighlight.create(Range.create(3, 4, 3, 7), DocumentHighlightKind.Text))
        })

        it('should return null when no conditional block matches the cursor position', () => {
            const content = 'if x > 0\n    y = 1\nend'
            const document = createDocument(content)

            const block = makeConditionalBlock(
                Range.create(0, 0, 2, 3),
                Range.create(0, 0, 0, 2),
                Range.create(2, 0, 2, 3)
            )
            setCodeInfo({ conditionalBlocks: [block] })

            const result = provider.getBlockHighlights(document, Position.create(1, 5))
            assert.strictEqual(result, null)
        })

        it('should return null when conditional blocks array is empty and cursor is on end', () => {
            const content = 'function foo\nend'
            const document = createDocument(content)

            setCodeInfo({ conditionalBlocks: [] })

            const result = provider.getBlockHighlights(document, Position.create(1, 1))
            assert.strictEqual(result, null)
        })
    })

    describe('definition block highlighting', () => {
        function makeFunctionScope (name: string, range: Range, argumentsBlocks: Range[] = [], nestedFunctions: Map<string, any> = new Map()): any {
            return {
                functionScopeInfo: {
                    range,
                    argumentsBlocks,
                    functionScopes: nestedFunctions
                }
            }
        }

        it('should highlight function/end keywords', () => {
            const content = 'function foo\n    x = 1\nend'
            const document = createDocument(content)

            const funcRange = Range.create(0, 0, 2, 3)
            const functionScopes = new Map([
                ['foo', makeFunctionScope('foo', funcRange)]
            ])

            setCodeInfo({
                conditionalBlocks: [],
                globalScopeInfo: {
                    classScope: undefined,
                    functionScopes
                }
            })

            const result = provider.getBlockHighlights(document, Position.create(0, 3))

            assert.ok(result != null)
            assert.strictEqual(result.length, 2)
            assert.deepStrictEqual(result[0], DocumentHighlight.create(Range.create(0, 0, 0, 8), DocumentHighlightKind.Text))
            assert.deepStrictEqual(result[1], DocumentHighlight.create(Range.create(2, 0, 2, 3), DocumentHighlightKind.Text))
        })

        it('should highlight function/end when cursor is on end keyword', () => {
            const content = 'function foo\n    x = 1\nend'
            const document = createDocument(content)

            const funcRange = Range.create(0, 0, 2, 1)
            const functionScopes = new Map([
                ['foo', makeFunctionScope('foo', funcRange)]
            ])

            setCodeInfo({
                conditionalBlocks: [],
                globalScopeInfo: {
                    classScope: undefined,
                    functionScopes
                }
            })

            const result = provider.getBlockHighlights(document, Position.create(2, 1))

            assert.ok(result != null)
            assert.strictEqual(result.length, 2)
            assert.deepStrictEqual(result[0], DocumentHighlight.create(Range.create(0, 0, 0, 8), DocumentHighlightKind.Text))
            assert.deepStrictEqual(result[1], DocumentHighlight.create(Range.create(2, 0, 2, 3), DocumentHighlightKind.Text))
        })

        it('should select innermost function for nested functions', () => {
            const content = 'function outer\n    function inner\n        x = 1\n    end\nend'
            const document = createDocument(content)

            const outerRange = Range.create(0, 0, 4, 3)
            const innerRange = Range.create(1, 4, 3, 7)

            const innerFuncScopes = new Map<string, any>()
            const innerFunc = makeFunctionScope('inner', innerRange)

            const outerFuncScopes = new Map([
                ['inner', innerFunc]
            ])
            const outerFunc = {
                functionScopeInfo: {
                    range: outerRange,
                    argumentsBlocks: [],
                    functionScopes: outerFuncScopes
                }
            }

            const functionScopes = new Map([
                ['outer', outerFunc]
            ])

            setCodeInfo({
                conditionalBlocks: [],
                globalScopeInfo: {
                    classScope: undefined,
                    functionScopes
                }
            })

            const result = provider.getBlockHighlights(document, Position.create(1, 6))

            assert.ok(result != null)
            assert.strictEqual(result.length, 2)
            assert.deepStrictEqual(result[0], DocumentHighlight.create(Range.create(1, 4, 1, 12), DocumentHighlightKind.Text))
            assert.deepStrictEqual(result[1], DocumentHighlight.create(Range.create(3, 4, 3, 7), DocumentHighlightKind.Text))
        })

        it('should highlight classdef/end keywords', () => {
            const content = 'classdef MyClass\n    properties\n    end\nend'
            const document = createDocument(content)

            const classRange = Range.create(0, 0, 3, 3)

            setCodeInfo({
                conditionalBlocks: [],
                globalScopeInfo: {
                    classScope: {
                        classdefInfo: {
                            range: classRange,
                            methodsBlocks: [],
                            propertiesBlocks: [],
                            enumerationsBlocks: [],
                            eventsBlocks: []
                        }
                    },
                    functionScopes: new Map()
                }
            })

            const result = provider.getBlockHighlights(document, Position.create(0, 4))

            assert.ok(result != null)
            assert.strictEqual(result.length, 2)
            assert.deepStrictEqual(result[0], DocumentHighlight.create(Range.create(0, 0, 0, 8), DocumentHighlightKind.Text))
            assert.deepStrictEqual(result[1], DocumentHighlight.create(Range.create(3, 0, 3, 3), DocumentHighlightKind.Text))
        })

        it('should highlight properties/end keywords', () => {
            const content = 'classdef MyClass\n    properties\n        x = 1\n    end\nend'
            const document = createDocument(content)

            const classRange = Range.create(0, 0, 4, 3)
            const propsRange = Range.create(1, 4, 3, 7)

            setCodeInfo({
                conditionalBlocks: [],
                globalScopeInfo: {
                    classScope: {
                        classdefInfo: {
                            range: classRange,
                            methodsBlocks: [],
                            propertiesBlocks: [{ name: 'properties', range: propsRange }],
                            enumerationsBlocks: [],
                            eventsBlocks: []
                        }
                    },
                    functionScopes: new Map()
                }
            })

            const result = provider.getBlockHighlights(document, Position.create(1, 6))

            assert.ok(result != null)
            assert.strictEqual(result.length, 2)
            assert.deepStrictEqual(result[0], DocumentHighlight.create(Range.create(1, 4, 1, 14), DocumentHighlightKind.Text))
            assert.deepStrictEqual(result[1], DocumentHighlight.create(Range.create(3, 4, 3, 7), DocumentHighlightKind.Text))
        })

        it('should highlight methods/end keywords', () => {
            const content = 'classdef MyClass\n    methods\n        function foo(obj)\n        end\n    end\nend'
            const document = createDocument(content)

            const classRange = Range.create(0, 0, 5, 3)
            const methodsRange = Range.create(1, 4, 4, 7)

            setCodeInfo({
                conditionalBlocks: [],
                globalScopeInfo: {
                    classScope: {
                        classdefInfo: {
                            range: classRange,
                            methodsBlocks: [{ name: 'methods', range: methodsRange }],
                            propertiesBlocks: [],
                            enumerationsBlocks: [],
                            eventsBlocks: []
                        }
                    },
                    functionScopes: new Map()
                }
            })

            const result = provider.getBlockHighlights(document, Position.create(1, 6))

            assert.ok(result != null)
            assert.strictEqual(result.length, 2)
            assert.deepStrictEqual(result[0], DocumentHighlight.create(Range.create(1, 4, 1, 11), DocumentHighlightKind.Text))
            assert.deepStrictEqual(result[1], DocumentHighlight.create(Range.create(4, 4, 4, 7), DocumentHighlightKind.Text))
        })

        it('should highlight arguments/end keywords', () => {
            const content = 'function foo(x)\n    arguments\n        x (1,1) double\n    end\nend'
            const document = createDocument(content)

            const funcRange = Range.create(0, 0, 4, 3)
            const argsRange = Range.create(1, 4, 3, 7)

            const functionScopes = new Map([
                ['foo', makeFunctionScope('foo', funcRange, [argsRange])]
            ])

            setCodeInfo({
                conditionalBlocks: [],
                globalScopeInfo: {
                    classScope: undefined,
                    functionScopes
                }
            })

            const result = provider.getBlockHighlights(document, Position.create(1, 8))

            assert.ok(result != null)
            assert.strictEqual(result.length, 2)
            assert.deepStrictEqual(result[0], DocumentHighlight.create(Range.create(1, 4, 1, 13), DocumentHighlightKind.Text))
            assert.deepStrictEqual(result[1], DocumentHighlight.create(Range.create(3, 4, 3, 7), DocumentHighlightKind.Text))
        })

        it('should not highlight end claimed by a conditional block', () => {
            const content = 'function foo\n    if x\n        y = 1\n    end\nend'
            const document = createDocument(content)

            const funcRange = Range.create(0, 0, 4, 3)
            const conditionalBlock = makeConditionalBlock(
                Range.create(1, 4, 3, 7),
                Range.create(1, 4, 1, 6),
                Range.create(3, 4, 3, 7)
            )

            const functionScopes = new Map([
                ['foo', makeFunctionScope('foo', funcRange)]
            ])

            setCodeInfo({
                conditionalBlocks: [conditionalBlock],
                globalScopeInfo: {
                    classScope: undefined,
                    functionScopes
                }
            })

            const result = provider.getBlockHighlights(document, Position.create(3, 5))

            assert.ok(result != null)
            assert.strictEqual(result.length, 2)
            assert.deepStrictEqual(result[0], DocumentHighlight.create(Range.create(1, 4, 1, 6), DocumentHighlightKind.Text))
            assert.deepStrictEqual(result[1], DocumentHighlight.create(Range.create(3, 4, 3, 7), DocumentHighlightKind.Text))
        })

        it('should return null when cursor is on end but no definition block matches', () => {
            const content = 'x = 1\nend'
            const document = createDocument(content)

            setCodeInfo({
                conditionalBlocks: [],
                globalScopeInfo: {
                    classScope: undefined,
                    functionScopes: new Map()
                }
            })

            const result = provider.getBlockHighlights(document, Position.create(1, 1))
            assert.strictEqual(result, null)
        })

        it('should return null when there are no definition blocks', () => {
            const content = 'function foo\nend'
            const document = createDocument(content)

            setCodeInfo({
                conditionalBlocks: [],
                globalScopeInfo: {
                    classScope: undefined,
                    functionScopes: new Map()
                }
            })

            const result = provider.getBlockHighlights(document, Position.create(0, 3))
            assert.strictEqual(result, null)
        })

        it('should prioritize conditional blocks over definition blocks', () => {
            const content = 'if true\n    x = 1\nend'
            const document = createDocument(content)

            const conditionalBlock = makeConditionalBlock(
                Range.create(0, 0, 2, 3),
                Range.create(0, 0, 0, 2),
                Range.create(2, 0, 2, 3)
            )

            setCodeInfo({
                conditionalBlocks: [conditionalBlock],
                globalScopeInfo: {
                    classScope: undefined,
                    functionScopes: new Map()
                }
            })

            const result = provider.getBlockHighlights(document, Position.create(2, 1))

            assert.ok(result != null)
            assert.strictEqual(result.length, 2)
            assert.deepStrictEqual(result[0], DocumentHighlight.create(Range.create(0, 0, 0, 2), DocumentHighlightKind.Text))
            assert.deepStrictEqual(result[1], DocumentHighlight.create(Range.create(2, 0, 2, 3), DocumentHighlightKind.Text))
        })
    })
})
