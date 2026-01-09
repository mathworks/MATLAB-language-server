// Copyright 2025 The MathWorks, Inc.

import assert from 'assert'

import FileInfoIndex, {
    CodeInfo, MatlabClassReferenceInfo, MatlabFunctionOrUnboundReferenceInfo, MatlabVariableInfo, ScopedNamedRange,
    SectionInfo
} from '../../src/indexing/FileInfoIndex'

import { Range } from 'vscode-languageserver'

describe('FileInfoIndex', () => {
    let fileInfoIndex: FileInfoIndex

    const resourceFilePathPrefix = './rawCodeDataResourceFiles'
    const specCasesResourceFilePathPrefix = `${resourceFilePathPrefix}/improvedCodeAnalysisSpecCases`
    const generalCasesResourceFilePathPrefix = `${specCasesResourceFilePathPrefix}/generalCases`
    const functionCasesResourceFilePathPrefix = `${specCasesResourceFilePathPrefix}/functionCases`
    const classCasesResourceFilePathPrefix = `${specCasesResourceFilePathPrefix}/classCases`

    // General cases
    let G_1_rawCodeData: CodeInfo
    let G_2_rawCodeData: CodeInfo

    // Function cases
    let F_1_rawCodeData: CodeInfo
    let F_2_rawCodeData: CodeInfo
    let F_3_rawCodeData: CodeInfo
    let F_9_rawCodeData: CodeInfo

    // Class cases
    let C_1_rawCodeData: CodeInfo
    let C_2_rawCodeData: CodeInfo
    let C_3_rawCodeData: CodeInfo

    // Additional test files
    let MyClass_rawCodeData: CodeInfo

    before(() => {
        // General cases
        G_1_rawCodeData = require(`${generalCasesResourceFilePathPrefix}/G_1.json`)
        G_2_rawCodeData = require(`${generalCasesResourceFilePathPrefix}/G_2.json`)

        // Function cases
        F_1_rawCodeData = require(`${functionCasesResourceFilePathPrefix}/F_1.json`)
        F_2_rawCodeData = require(`${functionCasesResourceFilePathPrefix}/F_2.json`)
        F_3_rawCodeData = require(`${functionCasesResourceFilePathPrefix}/F_3.json`)
        F_9_rawCodeData = require(`${functionCasesResourceFilePathPrefix}/F_9.json`)

        // Class cases
        C_1_rawCodeData = require(`${classCasesResourceFilePathPrefix}/C_1.json`)
        C_2_rawCodeData = require(`${classCasesResourceFilePathPrefix}/C_2.json`)
        C_3_rawCodeData = require(`${classCasesResourceFilePathPrefix}/C_3.json`)

        // Additional test files
        MyClass_rawCodeData = require(`${resourceFilePathPrefix}/@MyClass/MyClass.json`)
    })

    const setup = () => {
        fileInfoIndex = new FileInfoIndex()
    }

    describe('#parseAndStoreCodeInfo', () => {
        beforeEach(() => setup())

        it('stores the parsed code info in the code info cache', () => {
            const parsedCodeData = fileInfoIndex.parseAndStoreCodeInfo('G_1.m', G_1_rawCodeData)

            assert.strictEqual(
                fileInfoIndex.codeInfoCache.get('G_1.m'),
                parsedCodeData
            )
        })

        it('overwrites old code info for a file with new code info for the same file', () => {
            fileInfoIndex.parseAndStoreCodeInfo('G_1.m', G_1_rawCodeData)
            // as if the contents of G_1.m were updated to match G_2.m
            const updatedParsedCodeData = fileInfoIndex.parseAndStoreCodeInfo('G_1.m', G_2_rawCodeData)

            assert.strictEqual(
                fileInfoIndex.codeInfoCache.get('G_1.m'),
                updatedParsedCodeData
            )
        })

        it('does not overwrite code info for a file with code info for a different file', () => {
            const G_1_pcd = fileInfoIndex.parseAndStoreCodeInfo('G_1.m', G_1_rawCodeData)
            const G_2_pcd = fileInfoIndex.parseAndStoreCodeInfo('G_2.m', G_2_rawCodeData)

            assert.strictEqual(
                fileInfoIndex.codeInfoCache.get('G_1.m'),
                G_1_pcd
            )
            assert.strictEqual(
                fileInfoIndex.codeInfoCache.get('G_2.m'),
                G_2_pcd
            )
        })

        it('correctly transfers basic info from the top-level CodeInfo object', () => {
            const pcd = fileInfoIndex.parseAndStoreCodeInfo('G_1.m', G_1_rawCodeData)

            assert.strictEqual(pcd.package, '')
            assert.strictEqual(pcd.classDefFolder, undefined)
            assert.strictEqual(pcd.uri, 'G_1.m')
            assert.strictEqual(pcd.associatedClassInfo, undefined)

            assert.deepStrictEqual(
                pcd.sections,
                [
                    {
                        name: 'Section1',
                        range: Range.create(0, 0, 3, 0),
                        isExplicit: false
                    }
                ] satisfies SectionInfo[]
            )

            assert.deepStrictEqual(pcd.classReferences, new Map())
        })

        it('correctly parses class references', () => {
            const pcd = fileInfoIndex.parseAndStoreCodeInfo('C_2.m', C_2_rawCodeData)

            const C_2_references = new MatlabClassReferenceInfo()
            C_2_references.addReference({
                name: 'C_2',
                range: Range.create(0, 9, 0, 12)
            })

            const OtherClass_references = new MatlabClassReferenceInfo()
            OtherClass_references.addReference({
                name: 'OtherClass',
                range: Range.create(0, 15, 0, 25)
            })
            OtherClass_references.addReference({
                name: 'OtherClass',
                range: Range.create(3, 21, 3, 31)
            })
            OtherClass_references.addReference({
                name: 'OtherClass',
                range: Range.create(9, 4, 9, 14)
            })
            OtherClass_references.addReference({
                name: 'OtherClass',
                range: Range.create(10, 4, 10, 14)
            })

            assert.deepStrictEqual(
                pcd.classReferences,
                new Map<string, MatlabClassReferenceInfo>([
                    ['C_2', C_2_references],
                    ['OtherClass', OtherClass_references]
                ])
            )
        })

        it('correctly parses variable references and definitions in the global scope', () => {
            const pcd = fileInfoIndex.parseAndStoreCodeInfo('G_1.m', G_1_rawCodeData)

            const x_variableInfo = new MatlabVariableInfo()

            x_variableInfo.addReference({
                name: 'x',
                range: Range.create(0, 0, 0, 1),
                components: [
                    {
                        name: 'x',
                        range: Range.create(0, 0, 0, 1)
                    }
                ]
            })
            x_variableInfo.addReference({
                name: 'x',
                range: Range.create(1, 0, 1, 1),
                components: [
                    {
                        name: 'x',
                        range: Range.create(1, 0, 1, 1)
                    }
                ]
            })
            x_variableInfo.addReference({
                name: 'x',
                range: Range.create(2, 4, 2, 5),
                components: [
                    {
                        name: 'x',
                        range: Range.create(2, 4, 2, 5)
                    }
                ]
            })

            x_variableInfo.addDefinition({
                name: 'x',
                range: Range.create(0, 0, 0, 1),
                components: [
                    {
                        name: 'x',
                        range: Range.create(0, 0, 0, 1)
                    }
                ]
            })
            x_variableInfo.addDefinition({
                name: 'x',
                range: Range.create(1, 0, 1, 1),
                components: [
                    {
                        name: 'x',
                        range: Range.create(1, 0, 1, 1)
                    }
                ]
            })

            const y_variableInfo = new MatlabVariableInfo()

            y_variableInfo.addReference({
                name: 'y',
                range: Range.create(2, 0, 2, 1),
                components: [
                    {
                        name: 'y',
                        range: Range.create(2, 0, 2, 1)
                    }
                ]
            })

            y_variableInfo.addDefinition({
                name: 'y',
                range: Range.create(2, 0, 2, 1),
                components: [
                    {
                        name: 'y',
                        range: Range.create(2, 0, 2, 1)
                    }
                ]
            })

            assert.deepStrictEqual(
                pcd.globalScopeInfo.variables,
                new Map<string, MatlabVariableInfo>([
                    ['x', x_variableInfo],
                    ['y', y_variableInfo]
                ])
            )
        })

        it('correctly parses function or unbound references in the global scope', () => {
            const pcd = fileInfoIndex.parseAndStoreCodeInfo('G_2.m', G_2_rawCodeData)

            const fun_references = new MatlabFunctionOrUnboundReferenceInfo()
            fun_references.addReference({
                name: 'fun',
                range: Range.create(0, 0, 0, 3),
                components: [
                    {
                        name: 'fun',
                        range: Range.create(0, 0, 0, 3)
                    }
                ],
                firstArgIdName: undefined
            })
            fun_references.addReference({
                name: 'fun',
                range: Range.create(5, 0, 5, 3),
                components: [
                    {
                        name: 'fun',
                        range: Range.create(5, 0, 5, 3)
                    }
                ],
                firstArgIdName: undefined
            })

            assert.deepStrictEqual(
                pcd.globalScopeInfo.functionOrUnboundReferences,
                new Map<string, MatlabFunctionOrUnboundReferenceInfo>([
                    ['fun', fun_references]
                ])
            )
        })

        it('correctly constructs the function scopes map in the global scope', () => {
            const pcd = fileInfoIndex.parseAndStoreCodeInfo('F_3.m', F_3_rawCodeData)

            // Check that there is function info for f1 and f2 (but not f3)
            assert.deepStrictEqual([...pcd.globalScopeInfo.functionScopes.keys()].sort(), ['f1', 'f2'])
        })

        it('correctly creates the parent link from a global scope to its code info', () => {
            const pcd = fileInfoIndex.parseAndStoreCodeInfo('G_1.m', G_1_rawCodeData)

            assert.strictEqual(pcd.globalScopeInfo.codeInfo, pcd)
        })

        it('creates the correct structure and transfers basic info for a function with only an implementation', () => {
            const pcd = fileInfoIndex.parseAndStoreCodeInfo('F_1.m', F_1_rawCodeData)

            const functionInfo = pcd.globalScopeInfo.functionScopes.get('fun')

            assert.ok(functionInfo)
            // (raw code data has false, since the function name
            // does not match the file name)
            assert.strictEqual(functionInfo.isPublic, false)
            assert.strictEqual(functionInfo.hasPrototypeInfo, false)
            assert.strictEqual(functionInfo.isStaticMethod, false)
            assert.strictEqual(functionInfo.isConstructor, false)
            
            const functionScopeInfo = functionInfo.functionScopeInfo

            assert.ok(functionScopeInfo)
            assert.deepStrictEqual(
                functionScopeInfo.declarationNameId,
                {
                    name: 'fun',
                    range: Range.create(0, 9, 0, 12)
                }
            )
            assert.deepStrictEqual(
                functionScopeInfo.range,
                Range.create(0, 0, 1, 3)
            )
        })

        it('correctly parses variable references and definitions in a function scope', () => {
            const pcd = fileInfoIndex.parseAndStoreCodeInfo('F_2.m', F_2_rawCodeData)

            // Variable info for f1

            const x_variableInfo = new MatlabVariableInfo()

            x_variableInfo.addReference({
                name: 'x',
                range: Range.create(1, 4, 1, 5),
                components: [
                    {
                        name: 'x',
                        range: Range.create(1, 4, 1, 5)
                    }
                ]
            })
            x_variableInfo.addReference({
                name: 'x',
                range: Range.create(2, 4, 2, 5),
                components: [
                    {
                        name: 'x',
                        range: Range.create(2, 4, 2, 5)
                    }
                ]
            })
            x_variableInfo.addReference({
                name: 'x',
                range: Range.create(3, 8, 3, 9),
                components: [
                    {
                        name: 'x',
                        range: Range.create(3, 8, 3, 9)
                    }
                ]
            })

            x_variableInfo.addDefinition({
                name: 'x',
                range: Range.create(1, 4, 1, 5),
                components: [
                    {
                        name: 'x',
                        range: Range.create(1, 4, 1, 5)
                    }
                ]
            })
            x_variableInfo.addDefinition({
                name: 'x',
                range: Range.create(2, 4, 2, 5),
                components: [
                    {
                        name: 'x',
                        range: Range.create(2, 4, 2, 5)
                    }
                ]
            })

            const y_variableInfo = new MatlabVariableInfo()

            y_variableInfo.addReference({
                name: 'y',
                range: Range.create(3, 4, 3, 5),
                components: [
                    {
                        name: 'y',
                        range: Range.create(3, 4, 3, 5)
                    }
                ]
            })

            y_variableInfo.addDefinition({
                name: 'y',
                range: Range.create(3, 4, 3, 5),
                components: [
                    {
                        name: 'y',
                        range: Range.create(3, 4, 3, 5)
                    }
                ]
            })

            const f1FunctionScopeInfo = pcd.globalScopeInfo.functionScopes.get('f1')?.functionScopeInfo

            assert.ok(f1FunctionScopeInfo)
            assert.deepStrictEqual(
                f1FunctionScopeInfo.variables,
                new Map<string, MatlabVariableInfo>([
                    ['x', x_variableInfo],
                    ['y', y_variableInfo]
                ])
            )
        })

        it('correctly parses function or unbound references in a function scope', () => {
            const pcd = fileInfoIndex.parseAndStoreCodeInfo('F_9.m', F_9_rawCodeData)

            // Function or unbound reference info for parent

            const disp_references = new MatlabFunctionOrUnboundReferenceInfo()
            disp_references.addReference({
                name: 'disp',
                range: Range.create(2, 4, 2, 8),
                components: [
                    {
                        name: 'disp',
                        range: Range.create(2, 4, 2, 8)
                    }
                ],
                firstArgIdName: 'x'
            })

            const parentFunctionScopeInfo = pcd.globalScopeInfo.functionScopes.get('parent')?.functionScopeInfo

            assert.ok(parentFunctionScopeInfo)
            assert.deepStrictEqual(
                parentFunctionScopeInfo.functionOrUnboundReferences,
                new Map<string, MatlabFunctionOrUnboundReferenceInfo>([
                    ['disp', disp_references]
                ])
            )
        })

        it('correctly constructs the function scopes map in a function scope', () => {
            const pcd = fileInfoIndex.parseAndStoreCodeInfo('F_3.m', F_3_rawCodeData)
            const f2FunctionScopeInfo = pcd.globalScopeInfo.functionScopes.get('f2')?.functionScopeInfo

            assert.ok(f2FunctionScopeInfo)
            // Check that there is function info for f3 (but not f1 or f2)
            assert.deepStrictEqual([...f2FunctionScopeInfo.functionScopes.keys()], ['f3'])
        })

        it('correctly parses input and output args in a function scope', () => {
            const pcd = fileInfoIndex.parseAndStoreCodeInfo('C_3.m', C_3_rawCodeData)
            const setMyPropertyFunctionScopeInfo =
                pcd.globalScopeInfo.classScope?.functionScopes.get('set.MyProperty')?.functionScopeInfo

            assert.ok(setMyPropertyFunctionScopeInfo)
            // Order is important (for determining presumed class instances)
            assert.deepStrictEqual(
                [...setMyPropertyFunctionScopeInfo.inputArgs],
                ['obj', 'val']
            )
            assert.deepStrictEqual(
                [...setMyPropertyFunctionScopeInfo.outputArgs],
                ['obj']
            )
        })

        it('correctly creates the parent link from a function scope to its global scope', () => {
            const pcd = fileInfoIndex.parseAndStoreCodeInfo('F_1.m', F_1_rawCodeData)
            const funFunctionScopeInfo = pcd.globalScopeInfo.functionScopes.get('fun')?.functionScopeInfo

            assert.ok(funFunctionScopeInfo)
            assert.strictEqual(funFunctionScopeInfo.parentScope, pcd.globalScopeInfo)
        })

        it('correctly creates the sibling link from a function scope to its function info', () => {
            const pcd = fileInfoIndex.parseAndStoreCodeInfo('F_1.m', F_1_rawCodeData)

            const funFunctionInfo = pcd.globalScopeInfo.functionScopes.get('fun')

            assert.ok(funFunctionInfo)

            const funFunctionScopeInfo = funFunctionInfo.functionScopeInfo

            assert.ok(funFunctionScopeInfo)
            assert.strictEqual(funFunctionScopeInfo.functionInfo, funFunctionInfo)
        })

        it('creates associated class info and class scope links for a classdef file', () => {
            const pcd = fileInfoIndex.parseAndStoreCodeInfo('C_1.m', C_1_rawCodeData)

            assert.ok(pcd.associatedClassInfo)
            assert.ok(pcd.globalScopeInfo.classScope)
            assert.strictEqual(pcd.associatedClassInfo, pcd.globalScopeInfo.classScope)
        })

        it('correctly parses property declarations for a class', () => {
            const pcd = fileInfoIndex.parseAndStoreCodeInfo('C_3.m', C_3_rawCodeData)

            const propertiesMap = new Map<string, ScopedNamedRange>([
                [
                    'MyProperty',
                    {
                        name: 'MyProperty',
                        range: Range.create(2, 8, 2, 18),
                        isPublic: true
                    }
                ],
                [
                    'ConstantProperty',
                    {
                        name: 'ConstantProperty',
                        range: Range.create(5, 8, 5, 24),
                        isPublic: true
                    }
                ]
            ])

            const classInfo = pcd.globalScopeInfo.classScope

            assert.ok(classInfo)
            assert.deepStrictEqual(classInfo.properties, propertiesMap)
        })

        it('correctly constructs the function scopes map for a class with no supplementary method files', () => {
            const pcd = fileInfoIndex.parseAndStoreCodeInfo('C_1.m', C_1_rawCodeData)
            const classInfo = pcd.globalScopeInfo.classScope
    
            assert.ok(classInfo)
            // Check that there is function info for C_1 and staticMethod (but not for local)
            assert.deepStrictEqual([...classInfo.functionScopes.keys()], ['C_1', 'staticMethod'])
        })

        it('creates a link to the classdef info for a classdef file', () => {
            const pcd = fileInfoIndex.parseAndStoreCodeInfo('C_1.m', C_1_rawCodeData)
            const classInfo = pcd.globalScopeInfo.classScope

            assert.ok(classInfo)
            assert.ok(classInfo.classdefInfo)
        })

        it('correctly transfers basic info into the classdef info for a classdef file', () => {
            const pcd = fileInfoIndex.parseAndStoreCodeInfo('MyClass.m', MyClass_rawCodeData)
            const classdefInfo = pcd.globalScopeInfo.classScope?.classdefInfo
            
            assert.ok(classdefInfo)
            assert.deepStrictEqual(
                classdefInfo.declarationNameId,
                {
                    name: 'MyClass',
                    range: Range.create(0, 9, 0, 16)
                }
            )
            assert.deepStrictEqual(
                classdefInfo.range,
                Range.create(0, 0, 26, 3)
            )
            assert.strictEqual(classdefInfo.isPublic, true)
            assert.deepStrictEqual(
                classdefInfo.baseClasses,
                [
                    {
                        name: 'Base1',
                        range: Range.create(0, 19, 0, 24)
                    },
                    {
                        name: 'Base2',
                        range: Range.create(0, 27, 0, 32)
                    },
                    {
                        name: 'Base3',
                        range: Range.create(0, 35, 0, 40)
                    }
                ]
            )
            assert.deepStrictEqual(
                classdefInfo.propertiesBlocks,
                [
                    {
                        name: 'properties',
                        range: Range.create(1, 4, 3, 7)
                    },
                    {
                        name: 'properties (Constant)',
                        range: Range.create(5, 4, 7, 7)
                    }
                ]
            )
            assert.deepStrictEqual(
                classdefInfo.enumerationsBlocks,
                [
                    {
                        name: 'enumeration',
                        range: Range.create(9, 4, 11, 7)
                    },
                    {
                        name: 'enumeration',
                        range: Range.create(13, 4, 15, 7)
                    }
                ]
            )
            assert.deepStrictEqual(
                classdefInfo.methodsBlocks,
                [
                    {
                        name: 'methods',
                        range: Range.create(17, 4, 21, 7)
                    },
                    {
                        name: 'methods (Static)',
                        range: Range.create(23, 4, 25, 7)
                    }
                ]
            )
        })

        it('correctly creates the parent link from classdef info to its global scope', () => {
            const pcd = fileInfoIndex.parseAndStoreCodeInfo('C_1.m', C_1_rawCodeData)
            const classdefInfo = pcd.globalScopeInfo.classScope?.classdefInfo
            
            assert.ok(classdefInfo)
            assert.strictEqual(classdefInfo.parentScope, pcd.globalScopeInfo)
        })

        it('correctly creates the sibling link from classdef info to its class info', () => {
            const pcd = fileInfoIndex.parseAndStoreCodeInfo('C_1.m', C_1_rawCodeData)

            const classInfo = pcd.globalScopeInfo.classScope
            assert.ok(classInfo)

            const classdefInfo = classInfo.classdefInfo

            assert.ok(classdefInfo)
            assert.strictEqual(classdefInfo.classInfo, classInfo)
        })
    })
})
