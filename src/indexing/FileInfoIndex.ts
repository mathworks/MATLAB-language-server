// Copyright 2022 - 2023 The MathWorks, Inc.

import { Position, Range } from 'vscode-languageserver'
import { isPositionGreaterThan, isPositionLessThanOrEqualTo } from '../utils/PositionUtils'

/**
 * Defines the structure of the raw data retrieved from MATLAB®.
 */
export interface RawCodeData {
    classInfo: CodeDataClassInfo
    functionInfo: CodeDataFunctionInfo[]
    packageName: string
    references: CodeDataReference[]
}

/**
 * Contains raw information about the file's class data
 */
interface CodeDataClassInfo {
    isClassDef: boolean // Whether or not the file represents a class definition
    hasClassInfo: boolean // Whether or not the file contains data related to a class (could be a class definition, or within a classdef folder)
    name: string
    range: CodeDataRange
    declaration: CodeDataRange
    properties: CodeDataMemberInfo[]
    enumerations: CodeDataMemberInfo[]
    classDefFolder: string
    baseClasses: string[]
}

/**
 * Contains raw information about a function
 */
interface CodeDataFunctionInfo {
    name: string
    range: CodeDataRange
    parentClass: string
    isPublic: boolean
    declaration?: CodeDataRange // Will be undefined if function is prototype
    variableInfo: CodeDataFunctionVariableInfo
    globals: string[]
    isPrototype: boolean
}

/**
 * Contains raw information about variables within a function
 */
interface CodeDataFunctionVariableInfo {
    definitions: CodeDataReference[]
    references: CodeDataReference[]
}

/**
 * Represents a reference to a variable or function. The first element is the
 * name of the variable. The second element is the range of that reference.
 */
type CodeDataReference = [string, CodeDataRange]

/**
 * Represents members of a class (e.g. Properties or Enumerations)
 */
interface CodeDataMemberInfo {
    name: string
    range: CodeDataRange
    parentClass: string
    isPublic: boolean
}

/**
 * Represents a range in the document.
 * Line and column values are 1-based.
 */
interface CodeDataRange {
    lineStart: number
    charStart: number
    lineEnd: number
    charEnd: number
}

export enum FunctionVisibility {
    Public,
    Private
}

/**
 * Serves as an cache of data extracted from files
 */
class FileInfoIndex {
    /**
     * Maps document URI to the code data
     */
    readonly codeDataCache = new Map<string, MatlabCodeData>()

    /**
     * Maps class name to class info
     */
    readonly classInfoCache = new Map<string, MatlabClassInfo>()

    /**
     * Parses the raw data into a more usable form. Caches the resulting data
     * in the code data index.
     *
     * @param uri The uri of the document from which the data was extracted
     * @param rawCodeData The raw data
     * @returns An object containing the parsed data
     */
    parseAndStoreCodeData (uri: string, rawCodeData: RawCodeData): MatlabCodeData {
        let parsedCodeData: MatlabCodeData

        if (rawCodeData.classInfo.hasClassInfo) {
            let classInfo = this.classInfoCache.get(rawCodeData.classInfo.name)
            if (classInfo == null) {
                // Class not discovered yet - need to create info object
                classInfo = new MatlabClassInfo(rawCodeData.classInfo, uri)
                this.classInfoCache.set(classInfo.name, classInfo)
            } else {
                // Class already known - update data
                classInfo.appendClassData(rawCodeData.classInfo, uri)
            }
            parsedCodeData = new MatlabCodeData(uri, rawCodeData, classInfo)
        } else {
            parsedCodeData = new MatlabCodeData(uri, rawCodeData)
        }

        // Store in cache
        this.codeDataCache.set(uri, parsedCodeData)

        return parsedCodeData
    }
}

/**
 * Class to contain info about a class
 */
export class MatlabClassInfo {
    readonly methods: Map<string, MatlabFunctionInfo>
    readonly properties: Map<string, MatlabClassMemberInfo>
    readonly enumerations: Map<string, MatlabClassMemberInfo>

    readonly name: string

    baseClasses: string[]
    readonly classDefFolder: string

    range?: Range
    declaration?: Range

    constructor (rawClassInfo: CodeDataClassInfo, public uri?: string) {
        this.methods = new Map<string, MatlabFunctionInfo>()
        this.properties = new Map<string, MatlabClassMemberInfo>()
        this.enumerations = new Map<string, MatlabClassMemberInfo>()

        this.name = rawClassInfo.name

        this.baseClasses = rawClassInfo.baseClasses
        this.classDefFolder = rawClassInfo.classDefFolder

        if (rawClassInfo.isClassDef) {
            this.range = convertRange(rawClassInfo.range)
            this.declaration = convertRange(rawClassInfo.declaration)
        }

        this.parsePropertiesAndEnums(rawClassInfo)
    }

    /**
     * Appends the new data to the existing class data.
     *
     * Specifically, when the new data represents the classdef file, information about
     * the URI, base classes, and range/declaration are added to the existing data.
     *
     * @param rawClassInfo The raw class data being appended
     * @param uri The document URI corresponding to the class data
     */
    appendClassData (rawClassInfo: CodeDataClassInfo, uri?: string): void {
        if (rawClassInfo.isClassDef) {
            // Data contains class definition
            this.uri = uri
            this.baseClasses = rawClassInfo.baseClasses
            this.range = convertRange(rawClassInfo.range)
            this.declaration = convertRange(rawClassInfo.declaration)
        } else {
            // Data contains supplementary class info - nothing to do in this situation
        }
    }

    /**
     * Appends info about a method to the class's info.
     *
     * This will not replace info about a method's implementation with info about a method prototype.
     *
     * @param functionInfo The method's information
     */
    addMethod (functionInfo: MatlabFunctionInfo): void {
        // Only store the method if a non-prototype version of it is not
        // already stored, as that will contain better information.
        const name = functionInfo.name
        const shouldStoreMethod = !functionInfo.isPrototype || (this.methods.get(name)?.isPrototype ?? true)

        if (shouldStoreMethod) {
            this.methods.set(name, functionInfo)
        }
    }

    /**
     * Parses information about the class's properties and enums from the raw data.
     *
     * @param rawClassInfo The raw class info
     */
    private parsePropertiesAndEnums (rawClassInfo: CodeDataClassInfo): void {
        rawClassInfo.properties.forEach(propertyInfo => {
            const name = propertyInfo.name
            this.properties.set(name, new MatlabClassMemberInfo(propertyInfo))
        })
        rawClassInfo.enumerations.forEach(enumerationInfo => {
            const name = enumerationInfo.name
            this.enumerations.set(name, new MatlabClassMemberInfo(enumerationInfo))
        })
    }
}

/**
 * Class to contain info about members of a class (e.g. Properties or Enumerations)
 */
export class MatlabClassMemberInfo {
    readonly name: string
    readonly range: Range
    readonly parentClass: string

    constructor (rawPropertyInfo: CodeDataMemberInfo) {
        this.name = rawPropertyInfo.name
        this.range = convertRange(rawPropertyInfo.range)
        this.parentClass = rawPropertyInfo.parentClass
    }
}

/**
 * Class to contain info about functions
 */
export class MatlabFunctionInfo {
    name: string

    range: Range
    declaration: Range | null

    isPrototype: boolean

    parentClass: string
    isClassMethod: boolean
    visibility: FunctionVisibility

    variableInfo: Map<string, MatlabVariableInfo>

    constructor (rawFunctionInfo: CodeDataFunctionInfo, public uri: string) {
        this.name = rawFunctionInfo.name

        this.range = convertRange(rawFunctionInfo.range)
        this.declaration = rawFunctionInfo.declaration != null ? convertRange(rawFunctionInfo.declaration) : null

        this.isPrototype = rawFunctionInfo.isPrototype

        this.parentClass = rawFunctionInfo.parentClass
        this.isClassMethod = this.parentClass !== ''
        this.visibility = rawFunctionInfo.isPublic ? FunctionVisibility.Public : FunctionVisibility.Private

        this.variableInfo = new Map<string, MatlabVariableInfo>()
        this.parseVariableInfo(rawFunctionInfo)
    }

    /**
     * Parses information about variables within the function from the raw data.
     *
     * @param rawFunctionInfo The raw function info
     */
    private parseVariableInfo (rawFunctionInfo: CodeDataFunctionInfo): void {
        const variableInfo = rawFunctionInfo.variableInfo
        const globals = rawFunctionInfo.globals

        variableInfo.definitions.forEach(varDefinition => {
            const name = varDefinition[0]
            const range = convertRange(varDefinition[1])

            const varInfo = this.getOrCreateVariableInfo(name, globals)
            varInfo.addDefinition(range)
        })

        variableInfo.references.forEach(varReference => {
            const name = varReference[0]
            const range = convertRange(varReference[1])

            const varInfo = this.getOrCreateVariableInfo(name, globals)
            varInfo.addReference(range)
        })
    }

    /**
     * Attempts to retrieve an existing MatlabVariableInfo object for the requested variable.
     * Creates a new instance if one does not already exist.
     *
     * @param name The variable's name
     * @param globals The list of global variables
     * @returns The MatlabVariableInfo object for the variable
     */
    private getOrCreateVariableInfo (name: string, globals: string[]): MatlabVariableInfo {
        let variableInfo = this.variableInfo.get(name)
        if (variableInfo == null) {
            const isGlobal = globals.includes(name)
            variableInfo = new MatlabVariableInfo(name, isGlobal)
            this.variableInfo.set(name, variableInfo)
        }
        return variableInfo
    }
}

/**
 * Class to contain info about variables
 */
class MatlabVariableInfo {
    readonly definitions: Range[] = []
    readonly references: Range[] = []

    constructor (public name: string, public isGlobal: boolean) {}

    /**
     * Add a definition for the variable
     *
     * @param range The range of the definition
     */
    addDefinition (range: Range): void {
        this.definitions.push(range)
    }

    /**
     * Add a reference for the variable
     *
     * @param range The range of the reference
     */
    addReference (range: Range): void {
        this.references.push(range)
    }
}

/**
 * Class to contain info about an entire file
 */
export class MatlabCodeData {
    readonly functions: Map<string, MatlabFunctionInfo>
    readonly references: Map<string, Range[]>

    readonly packageName: string

    constructor (public uri: string, rawCodeData: RawCodeData, public classInfo?: MatlabClassInfo) {
        this.functions = new Map<string, MatlabFunctionInfo>()
        this.references = new Map<string, Range[]>()

        this.packageName = rawCodeData.packageName

        this.parseFunctions(rawCodeData.functionInfo)
        this.parseReferences(rawCodeData.references)
    }

    /**
     * Whether or not the code data represents a class definition
     */
    get isClassDef (): boolean {
        return this.classInfo != null
    }

    /**
     * Finds the info for the function containing the given position.
     *
     * @param position A position in the document
     * @returns The info for the function containing the position, or null if no function contains that position.
     */
    findContainingFunction (position: Position): MatlabFunctionInfo | null {
        let containingFunction: MatlabFunctionInfo | null = null

        for (const functionInfo of this.functions.values()) {
            const start = functionInfo.range.start
            const end = functionInfo.range.end

            // Check if position is within range
            if (isPositionLessThanOrEqualTo(start, position) && isPositionGreaterThan(end, position)) {
                if (containingFunction == null) {
                    containingFunction = functionInfo
                } else {
                    // Prefer a narrower function if we already have a match (e.g. nested functions)
                    if (isPositionGreaterThan(start, containingFunction.range.start)) {
                        containingFunction = functionInfo
                    }
                }
            }
        }

        return containingFunction
    }

    /**
     * Parses information about the file's functions.
     *
     * @param functionInfos The raw information about the functions in the file
     */
    private parseFunctions (functionInfos: CodeDataFunctionInfo[]): void {
        functionInfos.forEach(functionInfo => {
            const fcnInfo = new MatlabFunctionInfo(functionInfo, this.uri)
            this.functions.set(fcnInfo.name, fcnInfo)

            if (fcnInfo.isClassMethod) {
                // Store the function info with the class as well
                this.classInfo?.addMethod(fcnInfo)
            }
        })
    }

    /**
     * Parses information about the file's variable and function references.
     *
     * @param references The raw information about the references in the file
     */
    private parseReferences (references: CodeDataReference[]): void {
        references.forEach(reference => {
            const funcName = reference[0]
            const range = convertRange(reference[1])

            if (!this.references.has(funcName)) {
                // First time seeing this reference
                this.references.set(funcName, [range])
            } else {
                this.references.get(funcName)?.push(range)
            }
        })
    }
}

/**
 * Converts from a CodeDataRange to a Range as expected by the language server APIs.
 *
 * @param codeDataRange The CodeDataRange
 * @returns A Range corresponding to the inputted range
 */
function convertRange (codeDataRange: CodeDataRange): Range {
    // When converting, need to change value from 1-based to 0-based
    return Range.create(
        codeDataRange.lineStart - 1,
        codeDataRange.charStart - 1,
        codeDataRange.lineEnd - 1,
        codeDataRange.charEnd - 1
    )
}

export default new FileInfoIndex()
