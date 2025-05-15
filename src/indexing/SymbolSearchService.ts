// Copyright 2024-2025 The MathWorks, Inc.

import { Location, Position, TextDocuments, Range } from 'vscode-languageserver'
import { TextDocument } from 'vscode-languageserver-textdocument'
import FileInfoIndex, { FunctionVisibility, MatlabClassMemberInfo, MatlabCodeData, MatlabFunctionInfo } from './FileInfoIndex'
import { Actions, reportTelemetryAction } from '../logging/TelemetryUtils'
import Expression from '../utils/ExpressionUtils'
import { getTextOnLine } from '../utils/TextDocumentUtils'
import PathResolver from '../providers/navigation/PathResolver'
import * as fs from 'fs/promises'
import Indexer from './Indexer'
import * as FileNameUtils from '../utils/FileNameUtils'

export enum RequestType {
    Definition,
    References,
    DocumentSymbol,
    RenameSymbol,
}

export function reportTelemetry (type: RequestType, errorCondition = ''): void {
    let action: Actions
    switch (type) {
        case RequestType.Definition:
            action = Actions.GoToDefinition
            break
        case RequestType.References:
            action = Actions.GoToReference
            break
        case RequestType.DocumentSymbol:
            action = Actions.DocumentSymbol
            break
        case RequestType.RenameSymbol:
            action = Actions.RenameSymbol
            break
    }
    reportTelemetryAction(action, errorCondition)
}

class SymbolSearchService {
    private static instance: SymbolSearchService
    protected readonly DOTTED_IDENTIFIER_REGEX = /[\w.]+/

    public static getInstance (): SymbolSearchService {
        if (SymbolSearchService.instance == null) {
            SymbolSearchService.instance = new SymbolSearchService()
        }

        return SymbolSearchService.instance
    }

    /**
     * Finds references of an expression.
     *
     * @param uri The URI of the document containing the expression
     * @param position The position of the expression
     * @param expression The expression for which we are looking for references
     * @param documentManager The text document manager
     * @param requestType The type of request (definition, references, or rename)
     * @returns The references' locations
     */
    findReferences (uri: string, position: Position, expression: Expression, documentManager: TextDocuments<TextDocument>, requestType: RequestType): Location[] {
        // Get code data for current file
        const codeData = FileInfoIndex.codeDataCache.get(uri)

        if (codeData == null) {
            // File not indexed - unable to look for references
            reportTelemetry(requestType, 'File not indexed')
            return []
        }

        const textDocument = documentManager.get(uri)

        if (textDocument == null) {
            reportTelemetry(requestType, 'No document')
            return []
        }

        const line = getTextOnLine(textDocument, position.line)
        const commentStart = line.indexOf('%')

        if (commentStart > -1 && commentStart < position.character) {
            // Current expression is in a comment - no references should be returned
            return []
        }

        const referencesInCodeData = this.findReferencesInCodeData(uri, position, expression, codeData)

        reportTelemetry(requestType)

        if (referencesInCodeData != null) {
            return referencesInCodeData
        }

        return []
    }

    /**
     * Searches for references, starting within the given code data. If the expression does not correspond to a local variable,
     *  the search is broadened to other indexed files in the user's workspace.
     *
     * @param uri The URI corresponding to the provided code data
     * @param position The position of the expression
     * @param expression The expression for which we are looking for references
     * @param codeData The code data which is being searched
     * @returns The references' locations, or null if no reference was found
     */
    private findReferencesInCodeData (uri: string, position: Position, expression: Expression, codeData: MatlabCodeData): Location[] | null {
        // If first part of expression is targeted - look for a local variable
        if (expression.selectedComponent === 0) {
            const containingFunction = codeData.findContainingFunction(position)
            if (containingFunction != null) {
                const varRefs = this.getVariableDefsOrRefs(containingFunction, expression.unqualifiedTarget, uri, RequestType.References)
                if (varRefs != null) {
                    return varRefs
                }
            }
        }

        // Check for functions in file
        const functionDeclaration = this.getFunctionDeclaration(codeData, expression.fullExpression)
        if (functionDeclaration != null && functionDeclaration.visibility === FunctionVisibility.Private) {
            // Found a local function. Look through this file's references
            return codeData.references.get(functionDeclaration.name)?.map(range => Location.create(uri, range)) ?? []
        }

        // Check other files
        const refs: Location[] = []

        for (const [, fileCodeData] of FileInfoIndex.codeDataCache) {
            if (fileCodeData.functions.get(expression.fullExpression)?.visibility === FunctionVisibility.Private) {
                // Skip files with other local functions
                continue
            }
            const varRefs = fileCodeData.references.get(expression.fullExpression)
            if (varRefs != null) {
                varRefs.forEach(range => refs.push(Location.create(fileCodeData.uri, range)))
            }
        }
        return refs
    }

    /**
     * Gets the definition/references of a variable within a function.
     *
     * @param containingFunction Info about a function
     * @param variableName The variable name for which we are looking for definitions or references
     * @param uri The URI of the file
     * @param requestType The type of request (definition or references)
     * @returns The locations of the definition(s) or references of the given variable name within the given function info, or null if none can be found
     */
    getVariableDefsOrRefs (containingFunction: MatlabFunctionInfo, variableName: string, uri: string, requestType: RequestType): Location[] | null {
        const variableInfo = containingFunction.variableInfo.get(variableName)

        if (variableInfo == null) {
            return null
        }

        const varInfoRanges = requestType === RequestType.Definition ? variableInfo.definitions : variableInfo.references

        return varInfoRanges.map(range => {
            return Location.create(uri, range)
        })
    }

    /**
     * Searches for info about a function within the given code data.
     *
     * @param codeData The code data being searched
     * @param functionName The name of the function being searched for
     * @returns The info about the desired function, or null if it cannot be found
     */
    getFunctionDeclaration (codeData: MatlabCodeData, functionName: string): MatlabFunctionInfo | null {
        let functionDecl = codeData.functions.get(functionName)
        if (codeData.isClassDef && (functionDecl == null || functionDecl.isPrototype)) {
            // For classes, look in the methods list to better handle @folders
            functionDecl = codeData.classInfo?.methods.get(functionName) ?? functionDecl
        }

        return functionDecl ?? null
    }

    /**
     * Searches for info about a property within the given code data.
     *
     * @param codeData The code data being searched
     * @param propertyName The name of the property being searched for
     * @returns The info about the desired property, or null if it cannot be found
     */
    getPropertyDeclaration (codeData: MatlabCodeData, propertyName: string): MatlabClassMemberInfo | null {
        if (codeData.classInfo == null) {
            return null
        }

        return codeData.classInfo.properties.get(propertyName) ?? null
    }

    /**
     * Finds the definition(s) of an expression.
     *
     * @param uri The URI of the document containing the expression
     * @param position The position of the expression
     * @param expression The expression for which we are looking for the definition
     * @param matlabConnection The connection to MATLAB®
     * @param pathResolver The path resolver
     * @param indexer The workspace indexer
     * @returns The definition location(s)
     */
    async findDefinition (uri: string, position: Position, expression: Expression, pathResolver: PathResolver, indexer: Indexer): Promise<Location[]> {
        // Get code data for current file
        const codeData = FileInfoIndex.codeDataCache.get(uri)

        if (codeData == null) {
            // File not indexed - unable to look for definition
            reportTelemetry(RequestType.Definition, 'File not indexed')
            return []
        }

        // First check within the current file's code data
        const definitionInCodeData = this.findDefinitionInCodeData(uri, position, expression, codeData)

        if (definitionInCodeData != null) {
            reportTelemetry(RequestType.Definition)
            return definitionInCodeData
        }

        // Check the MATLAB path
        const definitionOnPath = await this.findDefinitionOnPath(uri, position, expression, pathResolver, indexer)

        if (definitionOnPath != null) {
            reportTelemetry(RequestType.Definition)
            return definitionOnPath
        }

        // If not on path, may be in user's workspace
        reportTelemetry(RequestType.Definition)
        return this.findDefinitionInWorkspace(uri, expression)
    }

    /**
     * Searches the given code data for the definition(s) of the given expression
     *
     * @param uri The URI corresponding to the provided code data
     * @param position The position of the expression
     * @param expression The expression for which we are looking for the definition
     * @param codeData The code data which is being searched
     * @returns The definition location(s), or null if no definition was found
     */
    private findDefinitionInCodeData (uri: string, position: Position, expression: Expression, codeData: MatlabCodeData): Location[] | null {
        // If first part of expression targeted - look for a local variable
        if (expression.selectedComponent === 0) {
            const containingFunction = codeData.findContainingFunction(position)
            if (containingFunction != null) {
                const varDefs = this.getVariableDefsOrRefs(containingFunction, expression.unqualifiedTarget, uri, RequestType.Definition)
                if (varDefs != null) {
                    return varDefs
                }
            }
        }

        // Check for functions in file
        let functionDeclaration = this.getFunctionDeclaration(codeData, expression.fullExpression)
        if (functionDeclaration != null) {
            return [this.getLocationForFunctionDeclaration(functionDeclaration)]
        }

        // Check for definitions within classes
        if (codeData.isClassDef && codeData.classInfo != null) {
            // Look for methods/properties within class definitions (e.g. obj.foo)
            functionDeclaration = this.getFunctionDeclaration(codeData, expression.last)
            if (functionDeclaration != null) {
                return [this.getLocationForFunctionDeclaration(functionDeclaration)]
            }

            // Look for possible properties
            if (expression.selectedComponent === 1) {
                const propertyDeclaration = this.getPropertyDeclaration(codeData, expression.last)
                if (propertyDeclaration != null) {
                    const propertyRange = Range.create(propertyDeclaration.range.start, propertyDeclaration.range.end)
                    const uri = codeData.classInfo.uri
                    if (uri != null) {
                        return [Location.create(uri, propertyRange)]
                    }
                }
            }
        }

        return null
    }

    /**
     * Gets the location of the given function's declaration. If the function does not have
     * a definite declaration, provides a location at the beginning of the file. For example,
     * this may be the case for built-in functions like 'plot'.
     *
     * @param functionInfo Info about the function
     * @returns The location of the function declaration
     */
    private getLocationForFunctionDeclaration (functionInfo: MatlabFunctionInfo): Location {
        const range = functionInfo.declaration ?? Range.create(0, 0, 0, 0)
        return Location.create(functionInfo.uri, range)
    }

    /**
     * Searches the MATLAB path for the definition of the given expression
     *
     * @param uri The URI of the file containing the expression
     * @param position The position of the expression
     * @param expression The expression for which we are looking for the definition
     * @param matlabConnection The connection to MATLAB
     * @param pathResolver The path resolver
     * @param indexer The workspace indexer
     * @returns The definition location(s), or null if no definition was found
     */
    private async findDefinitionOnPath (uri: string, position: Position, expression: Expression, pathResolver: PathResolver, indexer: Indexer): Promise<Location[] | null> {
        const resolvedUri = await pathResolver.resolvePath(expression.targetExpression, uri)

        if (resolvedUri === '' || resolvedUri === null) {
            // Not found
            return null
        }

        // Ensure URI is not a directory. This can occur with some packages.
        const fileStats = await fs.stat(FileNameUtils.getFilePathFromUri(resolvedUri))
        if (fileStats.isDirectory()) {
            return null
        }

        if (!FileInfoIndex.codeDataCache.has(resolvedUri)) {
            // Index target file, if necessary
            await indexer.indexFile(resolvedUri)
        }

        const codeData = FileInfoIndex.codeDataCache.get(resolvedUri)

        // Find definition location within determined file
        if (codeData != null) {
            const definition = this.findDefinitionInCodeData(resolvedUri, position, expression, codeData)

            if (definition != null) {
                return definition
            }
        }

        // If a definition location cannot be identified, default to the beginning of the file.
        // This could be the case for builtin functions which don't actually have a definition in a .m file (e.g. plot).
        return [Location.create(resolvedUri, Range.create(0, 0, 0, 0))]
    }

    /**
     * Searches the (indexed) workspace for the definition of the given expression. These files may not be on the MATLAB path.
     *
     * @param uri The URI of the file containing the expression
     * @param expression The expression for which we are looking for the definition
     * @returns The definition location(s). Returns an empty array if no definitions found.
     */
    private findDefinitionInWorkspace (uri: string, expression: Expression): Location[] {
        const expressionToMatch = expression.fullExpression

        for (const [fileUri, fileCodeData] of FileInfoIndex.codeDataCache) {
            if (uri === fileUri) continue // Already looked in the current file

            let match = fileCodeData.packageName === '' ? '' : fileCodeData.packageName + '.'

            if (fileCodeData.classInfo != null) {
                const classUri = fileCodeData.classInfo.uri
                if (classUri == null) continue

                // Check class name
                match += fileCodeData.classInfo.name
                if (expressionToMatch === match) {
                    const range = fileCodeData.classInfo.declaration ?? Range.create(0, 0, 0, 0)
                    return [Location.create(classUri, range)]
                }

                // Check properties
                const matchedProperty = this.findMatchingClassMember(expressionToMatch, match, classUri, fileCodeData.classInfo.properties)
                if (matchedProperty != null) {
                    return matchedProperty
                }

                // Check enums
                const matchedEnum = this.findMatchingClassMember(expressionToMatch, match, classUri, fileCodeData.classInfo.enumerations)
                if (matchedEnum != null) {
                    return matchedEnum
                }
            }

            // Check functions
            for (const [funcName, funcData] of fileCodeData.functions) {
                const funcMatch = (match === '') ? funcName : match + '.' + funcName

                // Need to ensure that a function with a matching name should also be visible from the current file.
                if (expressionToMatch === funcMatch && this.isFunctionVisibleFromUri(uri, funcData)) {
                    const range = funcData.declaration ?? Range.create(0, 0, 0, 0)
                    return [Location.create(funcData.uri, range)]
                }
            }
        }

        return []
    }

    /**
     * Finds the class member (property or enumeration) in the given map which matches to given expression.
     *
     * @param expressionToMatch The expression being compared against
     * @param matchPrefix The prefix which should be attached to the class members before comparison
     * @param classUri The URI for the current class
     * @param classMemberMap The map of class members
     * @returns An array containing the location of the matched class member, or null if one was not found
     */
    private findMatchingClassMember (expressionToMatch: string, matchPrefix: string, classUri: string, classMemberMap: Map<string, MatlabClassMemberInfo>): Location[] | null {
        for (const [memberName, memberData] of classMemberMap) {
            const match = matchPrefix + '.' + memberName
            if (expressionToMatch === match) {
                return [Location.create(classUri, memberData.range)]
            }
        }

        return null
    }

    /**
     * Determines whether the given function should be visible from the given file URI.
     * The function is visible if it is contained within the same file, or is public.
     *
     * @param uri The file's URI
     * @param funcData The function data
     * @returns true if the function should be visible from the given URI; false otherwise
     */
    private isFunctionVisibleFromUri (uri: string, funcData: MatlabFunctionInfo): boolean {
        return uri === funcData.uri || funcData.visibility === FunctionVisibility.Public
    }
}

export default SymbolSearchService.getInstance()
