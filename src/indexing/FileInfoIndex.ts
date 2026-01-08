// Copyright 2022 - 2025 The MathWorks, Inc.

import { Range } from 'vscode-languageserver'
import Logger from '../logging/Logger'
import { URI } from 'vscode-uri'

// NOTE: Things like "variable definitions" and "function references" refer
// to whether the *first component* of an identifier, not the entity
// referred to by the identifier as a whole, is a variable or function

/**
 * Representation of a file's code data
 */
export interface CodeInfo {
    package: string
    sections: RawSectionInfo[]
    classReferences: RawNamedRange[]
    globalScope: GlobalScope
    hasClassInfo: boolean
    classDefFolder?: string
    errorInfo?: string
}

/**
 * Representation of the global scope of a file
 */
interface GlobalScope {
    variableDefinitions: RawIdentifier[]
    variableReferences: RawIdentifier[]
    functionOrUnboundReferences: RawFunctionOrUnboundIdentifier[]
    globals: string[]
    classScope?: ClassDefinition
    functionScopes: FunctionDefinition[]
}

interface NamedScope {
    declarationNameId: RawNamedRange
    range: RangeArray
    isPublic: boolean
}

/**
 * Representation of a class definition
 */
interface ClassDefinition extends NamedScope {
    baseClasses: RawNamedRange[]
    propertiesBlocks: RawNamedRange[]
    enumerationsBlocks: RawNamedRange[]
    methodsBlocks: RawNamedRange[]
    properties: RawScopedNamedRange[]
    enumerations: RawScopedNamedRange[]
    nestedScopes: FunctionDefinition[]
}

/**
 * Representation of a function
 */
interface FunctionDefinition extends NamedScope {
    isPrototype: boolean
    variableDefinitions: RawIdentifier[]
    variableReferences: RawIdentifier[]
    functionOrUnboundReferences: RawFunctionOrUnboundIdentifier[]
    globals: string[]
    nestedScopes: FunctionDefinition[]
    isConstructor: boolean
    isStaticMethod: boolean
    inputArgs: string[]
    outputArgs: string[]
}

/**** Define "Raw" interfaces to define the structure coming from `computeCodeData` ****/
type RangeArray = [startLine: number, startCharacter: number, endLine: number, endCharacter: number]

interface RawNamedRange {
    name: string
    range: RangeArray
}

interface RawIdentifier extends RawNamedRange {
    components: RawNamedRange[]
}

interface RawFunctionOrUnboundIdentifier extends RawIdentifier {
    firstArgIdName?: string
}

interface RawScopedNamedRange extends RawNamedRange {
    isPublic: boolean
}

interface RawSectionInfo extends RawNamedRange {
    isExplicit: boolean
}

/**** Define standard interfaces which adhere to LSP ranges ****/

/**
 * Represents a range associated with a name
 */
export interface NamedRange {
    name: string
    range: Range
}

export interface Identifier extends NamedRange {
    components: NamedRange[]
}

export interface FunctionOrUnboundIdentifier extends Identifier {
    firstArgIdName?: string
}

export interface ScopedNamedRange extends NamedRange {
    isPublic: boolean
}

export interface SectionInfo extends NamedRange {
    isExplicit: boolean
}

/**** Define conversion helper functions ****/

// These helper functions convert from "Raw" interfaces (which use
// simple arrays for ranges) to standard interfaces (which use LSP
// Range objects).

function convertRange (rangeArr: RangeArray): Range {
    return Range.create(rangeArr[0], rangeArr[1], rangeArr[2], rangeArr[3])
}

function convertNamedRange (rawNamedRange: RawNamedRange): NamedRange {
    return {
        name: rawNamedRange.name,
        range: convertRange(rawNamedRange.range)
    }
}

function convertIdentifier (rawIdentifier: RawIdentifier): Identifier {
    return {
        name: rawIdentifier.name,
        range: convertRange(rawIdentifier.range),
        components: rawIdentifier.components.map(convertNamedRange)
    }
}

function convertFunctionOrUnboundIdentifier (rawFunctionOrUnboundIdentifier: RawFunctionOrUnboundIdentifier): FunctionOrUnboundIdentifier {
    return {
        name: rawFunctionOrUnboundIdentifier.name,
        range: convertRange(rawFunctionOrUnboundIdentifier.range),
        components: rawFunctionOrUnboundIdentifier.components.map(convertNamedRange),
        firstArgIdName: rawFunctionOrUnboundIdentifier.firstArgIdName
    }
}

function convertScopedNamedRange (rawScopedNamedRange: RawScopedNamedRange): ScopedNamedRange {
    return {
        name: rawScopedNamedRange.name,
        range: convertRange(rawScopedNamedRange.range),
        isPublic: rawScopedNamedRange.isPublic
    }
}

function convertSectionInfo (rawSectionInfo: RawSectionInfo): SectionInfo {
    return {
        name: rawSectionInfo.name,
        range: convertRange(rawSectionInfo.range),
        isExplicit: rawSectionInfo.isExplicit
    }
}

/**
 * Serves as a cache of data extracted from files
 */
class FileInfoIndex {
    readonly codeInfoCache = new Map<string, MatlabCodeInfo>() // Maps URI to code info
    private readonly classInfoMap = new Map<string, MatlabClassInfo>() // Maps URI of classdef to class info

    parseAndStoreCodeInfo (uri: string, rawCodeInfo: CodeInfo): MatlabCodeInfo {
        let associatedClassInfo: MatlabClassInfo | undefined = undefined
        if (rawCodeInfo.hasClassInfo) {
            try {
                const associatedClassUri = this.getAssociatedClassUri(uri, rawCodeInfo)
                associatedClassInfo = this.classInfoMap.get(associatedClassUri)

                if (!associatedClassInfo) {
                    associatedClassInfo = new MatlabClassInfo()
                    this.classInfoMap.set(associatedClassUri, associatedClassInfo)
                }
            } catch (e) {
                Logger.error(`Error determining associated class URI for file ${uri}: ${e}`)
            }
        }

        const parsedCodeInfo = new MatlabCodeInfo(uri, rawCodeInfo, associatedClassInfo)
        this.codeInfoCache.set(uri, parsedCodeInfo)

        return parsedCodeInfo
    }

    private getAssociatedClassUri (uri: string, rawCodeInfo: CodeInfo): string {
        if (rawCodeInfo.globalScope.classScope) {
            // Handle class definition
            return uri
        } else {
            // Handle file in class folder

            // Find the URI of the class folder (%40 represents
            // the @ sign)
            const classFolderUriMatch = uri.match(/.*%40[a-zA-Z]\w*/)
            // Find the name of the class within the part of
            // the URI naming the class folder (%40 represents
            // the @ sign)
            const classNameMatch = uri.match(/%40([a-zA-Z]\w*)/)
            if (classFolderUriMatch && classNameMatch) {
                return `${classFolderUriMatch[0]}/${classNameMatch[1]}.m`
            } else {
                throw new Error(`Unable to determine associated class URI of file with URI: ${uri}`)
            }
        }
    }
}

export class MatlabCodeInfo {
    readonly package: string
    readonly sections: SectionInfo[]
    readonly classReferences: IdentifierMap<MatlabClassReferenceInfo> = new Map()
    readonly globalScopeInfo: MatlabGlobalScopeInfo
    readonly classDefFolder?: string

    constructor (readonly uri: string, rawCodeInfo: CodeInfo, readonly associatedClassInfo?: MatlabClassInfo) {
        this.package = rawCodeInfo.package
        this.classDefFolder = rawCodeInfo.classDefFolder ? URI.file(rawCodeInfo.classDefFolder).toString() : undefined
        this.sections = rawCodeInfo.sections.map(convertSectionInfo)

        parseClassReferences(rawCodeInfo.classReferences.map(convertNamedRange), this.classReferences)

        this.globalScopeInfo = new MatlabGlobalScopeInfo(rawCodeInfo.globalScope, associatedClassInfo, this)
    }
}

export class MatlabGlobalScopeInfo {
    readonly variables: IdentifierMap<MatlabVariableInfo> = new Map()
    readonly globals: Set<string>
    readonly functionOrUnboundReferences: IdentifierMap<MatlabFunctionOrUnboundReferenceInfo> = new Map()
    readonly classScope?: MatlabClassInfo
    readonly functionScopes = new Map<string, MatlabFunctionInfo>()

    constructor (rawGlobalScopeInfo: GlobalScope, associatedClassInfo: MatlabClassInfo | undefined, readonly codeInfo: MatlabCodeInfo) {
        if (rawGlobalScopeInfo.classScope) {
            if (!associatedClassInfo) {
                Logger.error('No associated class info for a global scope containing a class scope')
            } else {
                associatedClassInfo.addClassdefInfo(rawGlobalScopeInfo.classScope, this)
                this.classScope = associatedClassInfo
            }
        }
        
        this.globals = new Set(rawGlobalScopeInfo.globals)

        this.parseFunctions(rawGlobalScopeInfo.functionScopes, associatedClassInfo)
        parseVariableReferences(rawGlobalScopeInfo.variableReferences.map(convertIdentifier), this.variables)
        parseVariableDefinitions(rawGlobalScopeInfo.variableDefinitions.map(convertIdentifier), this.variables)
        parseFunctionOrUnboundReferences(rawGlobalScopeInfo.functionOrUnboundReferences.map(convertFunctionOrUnboundIdentifier), this.functionOrUnboundReferences)
    }

    private parseFunctions (rawFunctionScopes: FunctionDefinition[], associatedClassInfo?: MatlabClassInfo): void {
        rawFunctionScopes.forEach((rawFunctionInfo, index) => {
            let parsedFunc: MatlabFunctionInfo

            // If this is the first function in a non-classdef file in a class folder,
            // add its info to the associated class so that the class info will hold
            // info about all the class's methods, even those outside the classdef file
            if (index === 0 && associatedClassInfo && !this.classScope) {
                parsedFunc = associatedClassInfo.addMethodInfo(rawFunctionInfo, this)
            } else {
                parsedFunc = new MatlabFunctionInfo(rawFunctionInfo, this)
            }

            this.functionScopes.set(rawFunctionInfo.declarationNameId.name, parsedFunc)
        })
    }
}

export type FunctionParentScope = MatlabGlobalScopeInfo | MatlabClassdefInfo | MatlabFunctionScopeInfo

export class MatlabFunctionScopeInfo {
    readonly declarationNameId: NamedRange
    readonly range: Range
    readonly variables: IdentifierMap<MatlabVariableInfo> = new Map()
    readonly globals: Set<string>
    readonly functionOrUnboundReferences: IdentifierMap<MatlabFunctionOrUnboundReferenceInfo> = new Map()
    readonly functionScopes = new Map<string, MatlabFunctionInfo>()
    readonly inputArgs: Set<string>
    readonly outputArgs: Set<string>

    constructor (rawFunctionInfo: FunctionDefinition, readonly parentScope: FunctionParentScope, readonly functionInfo: MatlabFunctionInfo) {
        this.declarationNameId = convertNamedRange(rawFunctionInfo.declarationNameId)
        this.range = convertRange(rawFunctionInfo.range)
        this.globals = new Set(rawFunctionInfo.globals)
        this.inputArgs = new Set(rawFunctionInfo.inputArgs)
        this.outputArgs = new Set(rawFunctionInfo.outputArgs)

        this.parseFunctions(rawFunctionInfo.nestedScopes)
        parseVariableReferences(rawFunctionInfo.variableReferences.map(convertIdentifier), this.variables)
        parseVariableDefinitions(rawFunctionInfo.variableDefinitions.map(convertIdentifier), this.variables)
        parseFunctionOrUnboundReferences(rawFunctionInfo.functionOrUnboundReferences.map(convertFunctionOrUnboundIdentifier), this.functionOrUnboundReferences)
    }

    private parseFunctions (rawFunctionScopes: FunctionDefinition[]): void {
        for (const rawFunctionInfo of rawFunctionScopes) {
            const parsedFunc = new MatlabFunctionInfo(rawFunctionInfo, this)
            this.functionScopes.set(rawFunctionInfo.declarationNameId.name, parsedFunc)
        }
    }
}

export class MatlabFunctionInfo {
    isPublic: boolean
    hasPrototypeInfo: boolean
    isStaticMethod: boolean
    isConstructor: boolean

    functionScopeInfo?: MatlabFunctionScopeInfo

    constructor (rawFunctionInfo: FunctionDefinition, parentScope: FunctionParentScope, readonly isMethod = false) {
        this.isPublic = rawFunctionInfo.isPublic
        this.hasPrototypeInfo = rawFunctionInfo.isPrototype
        this.isStaticMethod = rawFunctionInfo.isStaticMethod
        this.isConstructor = rawFunctionInfo.isConstructor

        if (!rawFunctionInfo.isPrototype) {
            this.functionScopeInfo = new MatlabFunctionScopeInfo(rawFunctionInfo, parentScope, this)
        }
    }

    addAdditionalInfo (rawFunctionInfo: FunctionDefinition, parentScope: FunctionParentScope): void {
        if (this.hasPrototypeInfo && rawFunctionInfo.isPrototype) {
            return
        }
        if (this.functionScopeInfo && !rawFunctionInfo.isPrototype) {
            return
        }

        if (rawFunctionInfo.isPrototype) {
            this.isPublic = rawFunctionInfo.isPublic
            this.isStaticMethod = rawFunctionInfo.isStaticMethod
            this.hasPrototypeInfo = true
        } else {
            this.functionScopeInfo = new MatlabFunctionScopeInfo(rawFunctionInfo, parentScope, this)
        }
    }
}

export class MatlabClassdefInfo {
    readonly declarationNameId: NamedRange
    readonly range: Range
    readonly isPublic: boolean
    readonly baseClasses: NamedRange[]
    readonly propertiesBlocks: NamedRange[]
    readonly enumerationsBlocks: NamedRange[]
    readonly methodsBlocks: NamedRange[]

    constructor (rawClassDefinition: ClassDefinition, readonly parentScope: MatlabGlobalScopeInfo, readonly classInfo: MatlabClassInfo) {
        this.declarationNameId = convertNamedRange(rawClassDefinition.declarationNameId)
        this.range = convertRange(rawClassDefinition.range)
        this.isPublic = rawClassDefinition.isPublic
        this.baseClasses = rawClassDefinition.baseClasses.map(convertNamedRange)
        this.propertiesBlocks = rawClassDefinition.propertiesBlocks.map(convertNamedRange)
        this.enumerationsBlocks = rawClassDefinition.enumerationsBlocks.map(convertNamedRange)
        this.methodsBlocks = rawClassDefinition.methodsBlocks.map(convertNamedRange)
    }
}

// May initially only have information from a file in a class folder -
// may not have come across the classdef file yet!
export class MatlabClassInfo {
    readonly properties = new Map<string, ScopedNamedRange>()
    readonly enumerations = new Map<string, ScopedNamedRange>()
    readonly functionScopes = new Map<string, MatlabFunctionInfo>()

    classdefInfo?: MatlabClassdefInfo

    addClassdefInfo (rawClassdefInfo: ClassDefinition, parentScope: MatlabGlobalScopeInfo): void {
        if (this.classdefInfo) {
            return
        }

        const classdefInfo = new MatlabClassdefInfo(rawClassdefInfo, parentScope, this)

        this.parseClassdefProperties(rawClassdefInfo.properties.map(convertScopedNamedRange))
        this.parseClassdefEnumerations(rawClassdefInfo.enumerations.map(convertScopedNamedRange))
        this.parseClassdefFunctions(rawClassdefInfo.nestedScopes, classdefInfo)

        this.classdefInfo = classdefInfo
    }

    addMethodInfo (rawFunctionInfo: FunctionDefinition, parentScope: FunctionParentScope): MatlabFunctionInfo {
        const methodName = rawFunctionInfo.declarationNameId.name
        let methodInfo: MatlabFunctionInfo | undefined = this.functionScopes.get(methodName)

        if (methodInfo) {
            methodInfo.addAdditionalInfo(rawFunctionInfo, parentScope)
        } else {
            methodInfo = new MatlabFunctionInfo(rawFunctionInfo, parentScope, true)
            this.functionScopes.set(methodName, methodInfo)
        }

        return methodInfo
    }

    clear (): void {
        this.properties.clear()
        this.enumerations.clear()
        this.functionScopes.clear()

        this.classdefInfo = undefined
    }

    private parseClassdefFunctions (rawFunctionScopes: FunctionDefinition[], classdefInfo: MatlabClassdefInfo): void {
        for (const rawFunctionInfo of rawFunctionScopes) {
            this.addMethodInfo(rawFunctionInfo, classdefInfo)
        }
    }

    private parseClassdefProperties (properties: ScopedNamedRange[]): void {
        for (const propertyInfo of properties) {
            this.properties.set(propertyInfo.name, propertyInfo)
        }
    }

    private parseClassdefEnumerations (enums: ScopedNamedRange[]): void {
        for (const enumInfo of enums) {
            this.enumerations.set(enumInfo.name, enumInfo)
        }
    }
}

export type FunctionContainer =
    | MatlabGlobalScopeInfo
    | MatlabFunctionScopeInfo
    | MatlabClassInfo

export interface ReferenceInfo<T extends NamedRange> {
    references: T[]
}

// for Identifiers with components: first component name -> reference info
// otherwise: name -> reference info
export type IdentifierMap<T extends ReferenceInfo<any>> = Map<string, T>

function parseVariableReferences (
    references: Identifier[], variableMap: IdentifierMap<MatlabVariableInfo>
): void {
    for (const ref of references) {
        const variableInfo = getOrCreateIdentifierInfo(
            variableMap, ref.components[0].name, MatlabVariableInfo
        )
        variableInfo.addReference(ref)
    }
}

function parseVariableDefinitions (
    definitions: Identifier[], variableMap: IdentifierMap<MatlabVariableInfo>
): void {
    for (const def of definitions) {
        const variableInfo = getOrCreateIdentifierInfo(
            variableMap, def.components[0].name, MatlabVariableInfo
        )
        variableInfo.addDefinition(def)
    }
}

function parseFunctionOrUnboundReferences (
    references: FunctionOrUnboundIdentifier[], functionOrUnboundReferenceMap: IdentifierMap<MatlabFunctionOrUnboundReferenceInfo>
): void {
    for (const ref of references) {
        const referenceInfo = getOrCreateIdentifierInfo(
            functionOrUnboundReferenceMap, ref.components[0].name, MatlabFunctionOrUnboundReferenceInfo
        )
        referenceInfo.addReference(ref)
    }
}

function parseClassReferences (
    references: NamedRange[], classReferenceMap: IdentifierMap<MatlabClassReferenceInfo>
): void {
    for (const ref of references) {
        const referenceInfo = getOrCreateIdentifierInfo(
            classReferenceMap, ref.name, MatlabClassReferenceInfo
        )
        referenceInfo.addReference(ref)
    }
}

type Constructor<T> = { new (): T }

function getOrCreateIdentifierInfo<T extends ReferenceInfo<any>> (
    identifierMap: IdentifierMap<T>, key: string, IdentifierInfoFactory: Constructor<T>
): T {
    let identifierInfo: T | undefined = identifierMap.get(key)
    if (!identifierInfo) {
        identifierInfo = new IdentifierInfoFactory()
        identifierMap.set(key, identifierInfo)
    }
    return identifierInfo
}

export class MatlabVariableInfo implements ReferenceInfo<Identifier> {
    readonly definitions: Identifier[] = []
    readonly references: Identifier[] = []

    addDefinition (identifier: Identifier): void {
        this.definitions.push(identifier)
    }

    addReference (identifier: Identifier): void {
        this.references.push(identifier)
    }
}

export class MatlabFunctionOrUnboundReferenceInfo implements ReferenceInfo<FunctionOrUnboundIdentifier> {
    readonly references: FunctionOrUnboundIdentifier[] = []

    addReference (identifier: FunctionOrUnboundIdentifier): void {
        this.references.push(identifier)
    }
}

export class MatlabClassReferenceInfo implements ReferenceInfo<NamedRange> {
    readonly references: NamedRange[] = []

    addReference (reference: NamedRange): void {
        this.references.push(reference)
    }
}

export default FileInfoIndex
