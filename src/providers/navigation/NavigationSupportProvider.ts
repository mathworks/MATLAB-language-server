// Copyright 2022 - 2023 The MathWorks, Inc.

import { DefinitionParams, DocumentSymbolParams, Location, Position, Range, ReferenceParams, SymbolInformation, SymbolKind, TextDocuments } from 'vscode-languageserver'
import { TextDocument } from 'vscode-languageserver-textdocument'
import { URI } from 'vscode-uri'
import * as fs from 'fs/promises'
import FileInfoIndex, { FunctionVisibility, MatlabClassMemberInfo, MatlabCodeData, MatlabFunctionInfo } from '../../indexing/FileInfoIndex'
import Indexer from '../../indexing/Indexer'
import { MatlabConnection } from '../../lifecycle/MatlabCommunicationManager'
import MatlabLifecycleManager from '../../lifecycle/MatlabLifecycleManager'
import { getTextOnLine } from '../../utils/TextDocumentUtils'
import PathResolver from './PathResolver'
import { connection } from '../../server'
import LifecycleNotificationHelper from '../../lifecycle/LifecycleNotificationHelper'
import { ActionErrorConditions, Actions, reportTelemetryAction } from '../../logging/TelemetryUtils'
import DocumentIndexer from '../../indexing/DocumentIndexer'

/**
 * Represents a code expression, either a single identifier or a dotted expression.
 * For example, "plot" or "pkg.Class.func".
 */
class Expression {
    constructor (public components: string[], public selectedComponent: number) {}

    /**
     * The full, dotted expression
     */
    get fullExpression (): string {
        return this.components.join('.')
    }

    /**
     * The dotted expression up to and including the selected component
     */
    get targetExpression (): string {
        return this.components.slice(0, this.selectedComponent + 1).join('.')
    }

    /**
     * Only the selected component of the expression
     */
    get unqualifiedTarget (): string {
        return this.components[this.selectedComponent]
    }

    /**
     * The first component of the expression
     */
    get first (): string {
        return this.components[0]
    }

    /**
     * The last component of the expression
     */
    get last (): string {
        return this.components[this.components.length - 1]
    }
}

export enum RequestType {
    Definition,
    References,
    DocumentSymbol
}

function reportTelemetry (type: RequestType, errorCondition = ''): void {
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
    }
    reportTelemetryAction(action, errorCondition)
}

/**
 * Handles requests for navigation-related features.
 * Currently, this handles Go-to-Definition and Go-to-References.
 */
class NavigationSupportProvider {
    private readonly DOTTED_IDENTIFIER_REGEX = /[\w.]+/

    /**
     * Handles requests for definitions or references.
     *
     * @param params Parameters for the definition or references request
     * @param documentManager The text document manager
     * @param requestType The type of request (definition or references)
     * @returns An array of locations
     */
    async handleDefOrRefRequest (params: DefinitionParams | ReferenceParams, documentManager: TextDocuments<TextDocument>, requestType: RequestType): Promise<Location[]> {
        const matlabConnection = await MatlabLifecycleManager.getOrCreateMatlabConnection(connection)
        if (matlabConnection == null) {
            LifecycleNotificationHelper.notifyMatlabRequirement()
            reportTelemetry(requestType, ActionErrorConditions.MatlabUnavailable)
            return []
        }

        const uri = params.textDocument.uri
        const textDocument = documentManager.get(uri)

        if (textDocument == null) {
            reportTelemetry(requestType, 'No document')
            return []
        }

        // Find ID for which to find the definition or references
        const expression = this.getTarget(textDocument, params.position)

        if (expression == null) {
            // No target found
            reportTelemetry(requestType, 'No navigation target')
            return []
        }

        if (requestType === RequestType.Definition) {
            return await this.findDefinition(uri, params.position, expression, matlabConnection)
        } else {
            return this.findReferences(uri, params.position, expression)
        }
    }

    /**
     * Caches document symbols for URIs to deal with the case when indexing
     * temporarily fails while the user is in the middle of an edit. We might
     * consider moving logic like this into the indexer logic later as clearing
     * out index data in the middle of an edit will have other ill effects.
     */
    private readonly _documentSymbolCache = new Map<string, SymbolInformation[]>()

    /**
     *
     * @param params Parameters for the document symbol request
     * @param documentManager The text document manager
     * @param requestType The type of request
     * @returns Array of symbols found in the document
     */
    async handleDocumentSymbol (params: DocumentSymbolParams, documentManager: TextDocuments<TextDocument>, requestType: RequestType): Promise<SymbolInformation[]> {
        // Get or wait for MATLAB connection to handle files opened before MATLAB is ready.
        // Calling getOrCreateMatlabConnection would effectively make the onDemand launch
        // setting act as onStart.
        const matlabConnection = await MatlabLifecycleManager.getMatlabConnectionAsync()
        if (matlabConnection == null) {
            reportTelemetry(requestType, ActionErrorConditions.MatlabUnavailable)
            return []
        }

        const uri = params.textDocument.uri
        const textDocument = documentManager.get(uri)

        if (textDocument == null) {
            reportTelemetry(requestType, 'No document')
            return []
        }
        // Ensure document index is up to date
        await DocumentIndexer.ensureDocumentIndexIsUpdated(textDocument)
        const codeData = FileInfoIndex.codeDataCache.get(uri)
        if (codeData == null) {
            reportTelemetry(requestType, 'No code data')
            return []
        }
        // Result symbols in documented
        const result: SymbolInformation[] = []
        // Avoid duplicates coming from different data sources
        const visitedRanges: Set<Range> = new Set()
        /**
         * Push symbol info to result set
         */
        function pushSymbol (name: string, kind: SymbolKind, symbolRange: Range): void {
            if (!visitedRanges.has(symbolRange)) {
                result.push(SymbolInformation.create(name, kind, symbolRange, uri))
                visitedRanges.add(symbolRange)
            }
        }
        if (codeData.isMainClassDefDocument && codeData.classInfo != null) {
            const classInfo = codeData.classInfo
            if (codeData.classInfo.range != null) {
                pushSymbol(classInfo.name, SymbolKind.Class, codeData.classInfo.range)
            }
            classInfo.methods.forEach((info, name) => pushSymbol(name, SymbolKind.Method, info.range))
            classInfo.enumerations.forEach((info, name) => pushSymbol(name, SymbolKind.EnumMember, info.range))
            classInfo.properties.forEach((info, name) => pushSymbol(name, SymbolKind.Property, info.range))
        }
        codeData.functions.forEach((info, name) => pushSymbol(name, info.isClassMethod ? SymbolKind.Method : SymbolKind.Function, info.range))
        /**
         * Handle a case when the indexer fails due to the user being in the middle of an edit.
         * Here the documentSymbol cache has some symbols but the codeData cache has none. So we
         * assume that the user will soon fix their code and just fall back to what we knew for now.
         */
        if (result.length === 0) {
            const cached = this._documentSymbolCache.get(uri) ?? result
            if (cached.length > 0) {
                return cached
            }
        }
        this._documentSymbolCache.set(uri, result)
        return result
    }

    /**
     * Gets the definition/references request target expression.
     *
     * @param textDocument The text document
     * @param position The position in the document
     * @returns The expression at the given position, or null if no expression is found
     */
    private getTarget (textDocument: TextDocument, position: Position): Expression | null {
        const idAtPosition = this.getIdentifierAtPosition(textDocument, position)

        if (idAtPosition.identifier === '') {
            return null
        }

        const idComponents = idAtPosition.identifier.split('.')

        // Determine what component was targeted
        let length = 0
        let i = 0
        while (i < idComponents.length && length <= position.character - idAtPosition.start) {
            length += idComponents[i].length + 1 // +1 for '.'
            i++
        }

        return new Expression(idComponents, i - 1) // Compensate for extra increment in loop
    }

    /**
     * Determines the identifier (or dotted expression) at the given position in the document.
     *
     * @param textDocument The text document
     * @param position The position in the document
     * @returns An object containing the string identifier at the position, as well as the column number at which the identifier starts.
     */
    private getIdentifierAtPosition (textDocument: TextDocument, position: Position): { identifier: string, start: number } {
        let lineText = getTextOnLine(textDocument, position.line)

        const result = {
            identifier: '',
            start: -1
        }

        let matchResults = lineText.match(this.DOTTED_IDENTIFIER_REGEX)
        let offset = 0

        while (matchResults != null) {
            if (matchResults.index == null || matchResults.index > position.character) {
                // Already passed the cursor - no match found
                break
            }

            const startChar = offset + matchResults.index
            if (startChar + matchResults[0].length >= position.character) {
                // Found overlapping identifier
                result.identifier = matchResults[0]
                result.start = startChar
                break
            }

            // Match found too early in line - check for following matches
            lineText = lineText.substring(matchResults.index + matchResults[0].length)
            offset = startChar + matchResults[0].length

            matchResults = lineText.match(this.DOTTED_IDENTIFIER_REGEX)
        }

        return result
    }

    /**
     * Finds the definition(s) of an expression.
     *
     * @param uri The URI of the document containing the expression
     * @param position The position of the expression
     * @param expression The expression for which we are looking for the definition
     * @param matlabConnection The connection to MATLAB®
     * @returns The definition location(s)
     */
    private async findDefinition (uri: string, position: Position, expression: Expression, matlabConnection: MatlabConnection): Promise<Location[]> {
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
        const definitionOnPath = await this.findDefinitionOnPath(uri, position, expression, matlabConnection)

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
     * @returns The definition location(s), or null if no definition was found
     */
    private async findDefinitionOnPath (uri: string, position: Position, expression: Expression, matlabConnection: MatlabConnection): Promise<Location[] | null> {
        const resolvedPath = await PathResolver.resolvePaths([expression.targetExpression], uri, matlabConnection)
        const resolvedUri = resolvedPath[0].uri

        if (resolvedUri === '') {
            // Not found
            return null
        }

        // Ensure URI is not a directory. This can occur with some packages.
        const fileStats = await fs.stat(URI.parse(resolvedUri).fsPath)
        if (fileStats.isDirectory()) {
            return null
        }

        if (!FileInfoIndex.codeDataCache.has(resolvedUri)) {
            // Index target file, if necessary
            await Indexer.indexFile(resolvedUri)
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

    /**
     * Finds references of an expression.
     *
     * @param uri The URI of the document containing the expression
     * @param position The position of the expression
     * @param expression The expression for which we are looking for references
     * @returns The references' locations
     */
    private findReferences (uri: string, position: Position, expression: Expression): Location[] {
        // Get code data for current file
        const codeData = FileInfoIndex.codeDataCache.get(uri)

        if (codeData == null) {
            // File not indexed - unable to look for references
            reportTelemetry(RequestType.References, 'File not indexed')
            return []
        }

        const referencesInCodeData = this.findReferencesInCodeData(uri, position, expression, codeData)

        reportTelemetry(RequestType.References)

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
    private getVariableDefsOrRefs (containingFunction: MatlabFunctionInfo, variableName: string, uri: string, requestType: RequestType): Location[] | null {
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
    private getFunctionDeclaration (codeData: MatlabCodeData, functionName: string): MatlabFunctionInfo | null {
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
    private getPropertyDeclaration (codeData: MatlabCodeData, propertyName: string): MatlabClassMemberInfo | null {
        if (codeData.classInfo == null) {
            return null
        }

        return codeData.classInfo.properties.get(propertyName) ?? null
    }
}

export default new NavigationSupportProvider()
