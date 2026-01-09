// Copyright 2024-2025 The MathWorks, Inc.

import { Location, Position, TextDocuments, Range } from 'vscode-languageserver'
import { TextDocument } from 'vscode-languageserver-textdocument'
import FileInfoIndex, {
    FunctionContainer, FunctionOrUnboundIdentifier, FunctionParentScope,
    Identifier, IdentifierMap, MatlabClassdefInfo, MatlabClassInfo, MatlabCodeInfo, MatlabFunctionInfo,
    MatlabFunctionScopeInfo, MatlabGlobalScopeInfo, MatlabVariableInfo, NamedRange, ReferenceInfo, ScopedNamedRange
} from './FileInfoIndex'
import { Actions, reportTelemetryAction } from '../logging/TelemetryUtils'
import PathResolver from '../providers/navigation/PathResolver'
import * as fs from 'fs/promises'
import Indexer from './Indexer'
import { URI } from 'vscode-uri'
import { isPositionWithinRange } from '../utils/PositionUtils'

export enum RequestType {
    Definition,
    References,
    DocumentSymbol,
    RenameSymbol,
    DocumentHighlight
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
        case RequestType.DocumentHighlight:
            action = Actions.HighlightSymbol
            break
    }
    reportTelemetryAction(action, errorCondition)
}

//////////////////////// Public API ///////////////////////////

export interface RefsAndDefsResult {
    references: Location[]
    definitions: Location[]
}

/**
 * Finds references of the identifier at a particular position in a document.
 * 
 * References are found throughout the file the identifier is in; additionally,
 * for class methods and properties, the files in an enclosing class folder are
 * searched. An empty array is returned if the operation fails or if there is
 * no (supported) identifier at the given position.
 * 
 * Ranges in returned locations should not be modified.
 * 
 * @param uri The URI of the document containing the position for which to find references
 * @param position The position in the document for which to find references
 * @param fileInfoIndex The file info index (which would contain the code data for the
 *     document at the given URI if it has been indexed)
 * @param documentManager The document manager
 * @param requestType The type of request being made (used for telemetry reporting)
 * @returns Locations of the references for the identifier at the given position
 */
export function findReferences (
    uri: string, position: Position, fileInfoIndex: FileInfoIndex, documentManager: TextDocuments<TextDocument>,
    requestType: RequestType
): Location[] {
    const refsParams = getScopedIdAndCodeInfo(
        uri, position, fileInfoIndex, documentManager, requestType
    )

    if (refsParams == null) {
        return []
    }

    const [scopedId, codeInfo] = refsParams

    reportTelemetry(requestType)
    return findRefsOrDefs(scopedId, codeInfo, ResultType.References)
}

/**
 * Finds definitions/write references of the identifier at a particular position in a document.
 * 
 * Definitions are found throughout the file the identifier is in; additionally,
 * for class methods and properties, the files in an enclosing class folder are
 * searched. If no definitions of a class, function, or presumably unbound
 * reference are found in these file(s), we try to find the declaration file on
 * the MATLAB path and look for definitions in that file. When trying to find
 * the declaration file in this manner, additional dotted identifier components
 * beyond the one selected will be considered until a declaration is found. An
 * empty array is returned if the operation fails or if there is no (supported)
 * identifier at the given position.
 * 
 * Ranges in returned locations should not be modified.
 * 
 * @param uri The URI of the document containing the position for which to find definitions
 * @param position The position in the document for which to find definitions
 * @param fileInfoIndex The file info index (which would contain the code data for the
 *     document at the given URI if it has been indexed)
 * @param documentManager The document manager
 * @param pathResolver The path resolver
 * @param indexer The indexer
 * @param requestType The type of request being made (used for telemetry reporting)
 * @returns Locations of the definitions for the identifier at the given position
 */
export async function findDefinitions (
    uri: string, position: Position, fileInfoIndex: FileInfoIndex, documentManager: TextDocuments<TextDocument>,
    pathResolver: PathResolver, indexer: Indexer, requestType: RequestType
): Promise<Location[]> {
    const defsParams = getScopedIdAndCodeInfo(
        uri, position, fileInfoIndex, documentManager, requestType
    )

    if (defsParams == null) {
        return []
    }

    const [scopedId, codeInfo] = defsParams
    
    reportTelemetry(requestType)

    // First check within the current file's (and
    // associated class info's) code data
    const defsInCodeData: Location[] = findRefsOrDefs(scopedId, codeInfo, ResultType.Definitions)
    
    if (defsInCodeData.length > 0) {
        return defsInCodeData
    }
    
    // If no definitions are found in the current file/
    // associated class and the identifier type is able to
    // be defined outside the file, look for definitions
    // on the path
    if (scopedId instanceof ClassReference || scopedId instanceof ScopedFunctionOrUnboundReference) {
        return await findDefinitionsOnPathWithExpansion(scopedId, uri, pathResolver, indexer, fileInfoIndex)
    }
    
    return []
}

/**
 * Finds references and definitions of the identifier at a particular position in a document.
 * 
 * References and definitions are found throughout the file the identifier is
 * in; additionally, for class methods and properties, the files in an enclosing
 * class folder are searched. Empty arrays are returned if the operation fails
 * or if there is no (supported) identifier at the given position.
 * 
 * The definitions returned are a subset of the references returned, where
 * equality for two range objects is defined as whether they represent the same
 * range, even if the objects do not have the same identity.
 * 
 * Note that the path is not searched for definitions even if no definitions are
 * found; use {@link findReferences} and {@link findDefinitions} separately if
 * you want this definition finding behavior.
 * 
 * Ranges in returned locations should not be modified.
 * 
 * @param uri The URI of the document containing the position for which to find refs & defs
 * @param position The position in the document for which to find refs & defs
 * @param fileInfoIndex The file info index (which would contain the code data for the
 *     document at the given URI if it has been indexed)
 * @param documentManager The document manager
 * @param requestType The type of request being made (used for telemetry reporting)
 * @returns References and definitions for the identifier at the given position
 */
export function findReferencesAndDefinitions (
    uri: string, position: Position, fileInfoIndex: FileInfoIndex, documentManager: TextDocuments<TextDocument>,
    requestType: RequestType
): RefsAndDefsResult {
    const refsAndDefsParams = getScopedIdAndCodeInfo(
        uri, position, fileInfoIndex, documentManager, requestType
    )

    if (refsAndDefsParams == null) {
        return { references: [], definitions: [] }
    }

    const [scopedId, codeInfo] = refsAndDefsParams

    reportTelemetry(requestType)
    return findRefsOrDefs(scopedId, codeInfo, ResultType.All)
}

/**
 * Finds the selected identifier component at a particular position in a document.
 * 
 * If the identifier containing the given position has individual component
 * information (i.e., it is a variable, function, or presumably unbound reference),
 * the named range for the selected component is returned; otherwise, the named
 * range for the identifier as a whole is returned.
 * 
 * The returned objects should not be modified.
 * 
 * @param uri The URI of the document containing the position for which to find the selected identifier component
 * @param position The position in the document for which to find the selected identifier component
 * @param fileInfoIndex The file info index (which would contain the code data for the
 *     document at the given URI if it has been indexed)
 * @param documentManager The document manager
 * @returns The selected component of the identifier at the given position, or null if no identifier is found
 */
export function findSelectedIdentifierComponent (
    uri: string, position: Position, fileInfoIndex: FileInfoIndex, documentManager: TextDocuments<TextDocument>,
    requestType: RequestType
): NamedRange | null {
    const result = getScopedIdAndCodeInfo(
        uri, position, fileInfoIndex, documentManager, requestType
    )

    if (result == null) {
        return null
    }

    const [scopedId] = result

    if (scopedId instanceof ScopedVariableReference || scopedId instanceof ScopedFunctionOrUnboundReference) {
        return scopedId.id.components[scopedId.selectedComponentIndex]
    } else {
        return scopedId.id
    }
}

//////////////////////// Finding identifier at cursor position /////////////////////////

/**
 * Represents an identifier presumed to be a class reference based on
 * its position/context within a code file.
 */
class ClassReference {
    constructor (
        readonly id: NamedRange
    ) {}
}

/**
 * Represents an identifier that is classified as a variable reference
 * based on its position/context within a code file. It may actually
 * represent a variable ("var" or "struct.field"), method call
 * ("obj.fun"), or property ("obj.Prop").
 */
class ScopedVariableReference {
    constructor (
        readonly id: Identifier,
        readonly selectedComponentIndex: number,
        readonly scope: MatlabGlobalScopeInfo | MatlabFunctionScopeInfo
    ) {}
}

/**
 * Represents an identifier that is classified as a function or
 * unbound reference based on its position/context within a code file.
 * It may actually represent a function call, presumably unbound
 * identifier (possibly referring to a function or class defined in a
 * different file), or method call.
 */
class ScopedFunctionOrUnboundReference {
    constructor (
        readonly id: FunctionOrUnboundIdentifier,
        readonly selectedComponentIndex: number,
        readonly scope: MatlabGlobalScopeInfo | MatlabFunctionScopeInfo
    ) {}
}

/**
 * Represents a function/method declaration identifier (like "fun" in
 * "function fun").
 */
class ScopedFunctionDeclarationId {
    constructor (
        readonly id: NamedRange,
        readonly declaredFunctionScope: MatlabFunctionScopeInfo
    ) {}
}

/**
 * Represents a property declaration identifier (in a properties
 * block of a class).
 */
class ScopedPropertyDeclarationId {
    constructor (
        readonly id: ScopedNamedRange, readonly scope: MatlabClassdefInfo
    ) {}
}

type ScopedReference =
    | ClassReference
    | ScopedVariableReference
    | ScopedFunctionOrUnboundReference
    | ScopedFunctionDeclarationId
    | ScopedPropertyDeclarationId

type IdentifierScope =
    | MatlabCodeInfo
    | MatlabGlobalScopeInfo
    | MatlabFunctionScopeInfo
    | MatlabClassdefInfo

/**
 * Recursively searches a scope to find the info for the identifier at a given position.
 * 
 * @param scope The scope to search for identifiers (recursively)
 * @param position The position to find an identifier at
 * @returns A scoped reference representing the identifier found, the scope the identifier
 *     is directly contained within (if it is not a class reference), and the selected
 *     component if applicable, or null if no identifier is found
 */
function getIdentifierAtPosition (scope: IdentifierScope | undefined, position: Position): ScopedReference | null {
    if (scope === undefined) {
        return null
    }

    if (scope instanceof MatlabCodeInfo) {
        const result = getIdentifierAtPosition(scope.globalScopeInfo, position)
        if (result) return result

        // Class references are stored in the top-level
        // code info regardless of scope
        const classRef: NamedRange | null = searchIdentifierMap(scope.classReferences, position)
        if (classRef) return new ClassReference(classRef)
    } else if (scope instanceof MatlabClassdefInfo) {
        const classInfo: MatlabClassInfo = scope.classInfo

        // Note: enums not currently supported

        for (const functionInfo of classInfo.functionScopes.values()) {
            const functionScope = functionInfo.functionScopeInfo

            // Note: only check methods whose parent scope is a classdef -
            // other methods are supplementary class methods defined in
            // a different file
            if (functionScope?.parentScope instanceof MatlabClassdefInfo
                && isPositionWithinRange(position, functionScope.range)
            ) {
                return getIdentifierAtPosition(functionScope, position)
            }
        }

        const prop: ScopedNamedRange | null = searchReferences([...classInfo.properties.values()], position)
        if (prop) return new ScopedPropertyDeclarationId(prop, scope)
    } else { // global or function scope
        if (scope instanceof MatlabGlobalScopeInfo) {
            const classdef = scope.classScope?.classdefInfo
            if (classdef && isPositionWithinRange(position, classdef.range)) {
                return getIdentifierAtPosition(classdef, position)
            }
        }

        for (const functionInfo of scope.functionScopes.values()) {
            const functionScope = functionInfo.functionScopeInfo
            if (functionScope && isPositionWithinRange(position, functionScope.range)) {
                return getIdentifierAtPosition(functionInfo.functionScopeInfo, position)
            }
        }

        if (scope instanceof MatlabFunctionScopeInfo) {
            if (isPositionWithinRange(position, scope.declarationNameId.range)) {
                // We do not currently support functions with dots
                // in their name (property access methods or
                // namespace-class converter methods)
                if (scope.declarationNameId.name.includes('.')) {
                    return null
                }

                return new ScopedFunctionDeclarationId(scope.declarationNameId, scope)
            }
        }

        const varRef: Identifier | null = searchIdentifierMap(scope.variables, position)
        if (varRef) {
            const selectedComponentIndex: number | null = getSelectedComponentIndex(varRef, position)
            if (selectedComponentIndex != null) {
                return new ScopedVariableReference(varRef, selectedComponentIndex, scope)
            } else {
                return null
            }
        }

        const functionOrUnboundRef: FunctionOrUnboundIdentifier | null = searchIdentifierMap(
            scope.functionOrUnboundReferences, position
        )
        if (functionOrUnboundRef) {
            const selectedComponentIndex: number | null = getSelectedComponentIndex(functionOrUnboundRef, position)
            if (selectedComponentIndex != null) {
                return new ScopedFunctionOrUnboundReference(functionOrUnboundRef, selectedComponentIndex, scope)
            } else {
                return null
            }
        }
    }

    return null
}

/**
 * Searches an identifier map for a reference whose range contains the given cursor position.
 * 
 * @param map The identifier map to search
 * @param position The position to search for
 * @returns The found reference or null if not found
 */
function searchIdentifierMap<T extends NamedRange> (
    map: IdentifierMap<ReferenceInfo<T>>, position: Position
): T | null {
    for (const refInfo of map.values()) {
        const searchResult = searchReferences(refInfo.references, position)
        if (searchResult) return searchResult
    }

    return null
}

/**
 * Searches a list of references for a reference whose range contains the given cursor position.
 * 
 * @param refs The list of references to search
 * @param position The position to search for
 * @returns The found reference or null if not found
 */
function searchReferences<T extends NamedRange> (refs: T[], position: Position): T | null {
    for (const ref of refs) {
        if (isPositionWithinRange(position, ref.range)) {
            return ref
        }
    }

    return null
}

/**
 * Determines the index of the component of a given identifier that contains the given cursor position.
 * 
 * @param id The identifier containing the cursor position
 * @param position The cursor position to check against each component's range
 * @returns The index of the component that contains the position, or null if none do
 */
function getSelectedComponentIndex (id: Identifier, position: Position): number | null {
    for (const [index, component] of id.components.entries()) {
        if (isPositionWithinRange(position, component.range)) {
            return index
        }
    }
    return null
}

/////////////////////// Finding refs & defs main function //////////////////

/** Designates whether the references, definitions, or both of the given scoped id should be returned */
enum ResultType {
    References,
    Definitions,
    All
}

/**
 * Finds references and/or definitions of an identifier.
 * 
 * Use {@link getIdentifierAtPosition} to get the {@link scopedId} at a cursor
 * position. References and definitions will only be found in the file whose code
 * info is provided, unless the identifier is a class method or property, in which
 * case references and definitions will be found in the associated class info.
 * 
 * @param scopedId The scoped reference to find references and/or definitions for
 * @param codeInfo The code info for the file containing the scoped reference
 * @param resultType Determines whether to return references, definitions, or both
 * @returns Locations of references, definitions, or both, depending on the {@link resultType}
 */
function findRefsOrDefs (scopedId: ScopedReference, codeInfo: MatlabCodeInfo, resultType: ResultType.References | ResultType.Definitions): Location[]
function findRefsOrDefs (scopedId: ScopedReference, codeInfo: MatlabCodeInfo, resultType: ResultType.All): RefsAndDefsResult
function findRefsOrDefs (
    scopedId: ScopedReference, codeInfo: MatlabCodeInfo, resultType: ResultType
): Location[] | RefsAndDefsResult {
    if (scopedId instanceof ClassReference) {
        return findClassRefsOrDefs(scopedId.id.name, codeInfo, resultType)
    } else if (scopedId instanceof ScopedVariableReference) {
        return findVarSourcedRefsOrDefs(scopedId, codeInfo, resultType)
    } else if (scopedId instanceof ScopedFunctionOrUnboundReference) {
        return findFunctionOrUnboundRefsOrDefs(scopedId, codeInfo, resultType)
    } else if (scopedId instanceof ScopedFunctionDeclarationId) {
        return findFunctionDeclarationRefsOrDefs(scopedId, codeInfo, resultType)
    } else { // ScopedPropertyDeclarationId
        return findPropertyDeclarationRefsOrDefs(scopedId, codeInfo, resultType)
    }
}

///////////////// Finding class refs & defs //////////////////////

/**
 * Finds references and/or definitions of a ClassReference throughout a single file.
 * 
 * The ClassReference is assumed to refer to a class.
 * 
 * @param idName The name of the class to find references and/or definitions for
 * @param codeInfo The code info for the file containing the class reference
 * @param resultType Determines whether to return references, definitions, or both
 * @returns Locations of references, definitions, or both, depending on the {@link resultType}
 */
function findClassRefsOrDefs (idName: string, codeInfo: MatlabCodeInfo, resultType: ResultType.References | ResultType.Definitions): Location[]
function findClassRefsOrDefs (idName: string, codeInfo: MatlabCodeInfo, resultType: ResultType.All): RefsAndDefsResult
function findClassRefsOrDefs (idName: string, codeInfo: MatlabCodeInfo, resultType: ResultType): Location[] | RefsAndDefsResult
function findClassRefsOrDefs (
    idName: string, codeInfo: MatlabCodeInfo, resultType: ResultType
): Location[] | RefsAndDefsResult {
    const needRefs = resultType !== ResultType.Definitions
    const needDefs = resultType !== ResultType.References

    const refs: NamedRange[] | undefined = needRefs ? [] : undefined
    const defs: NamedRange[] | undefined = needDefs ? [] : undefined

    const classScope: MatlabClassInfo | undefined = codeInfo.globalScopeInfo?.classScope
    const classDeclarationId: NamedRange | undefined = classScope?.classdefInfo?.declarationNameId

    if (classDeclarationId?.name === idName) {
        // Note: The class declaration ID is included
        // automatically in the class references

        defs?.push(classDeclarationId)

        // If classScope were undefined, classDeclarationId
        // could not be defined
        const probableConstructor: MatlabFunctionInfo | undefined = classScope!.functionScopes.get(idName)

        if (probableConstructor?.isConstructor) {
            const constructorDeclarationId: NamedRange | undefined = probableConstructor.functionScopeInfo?.declarationNameId
            if (constructorDeclarationId) {
                // Constructor declaration names are not recorded
                // in the class references map
                refs?.push(constructorDeclarationId)
                defs?.push(constructorDeclarationId)
            }
        }
    }

    refs?.push(...(codeInfo.classReferences.get(idName)?.references ?? []))

    return formatRefsOrDefsResult(
        refs?.map(id => Location.create(codeInfo.uri, id.range)),
        defs?.map(id => Location.create(codeInfo.uri, id.range)),
        resultType
    )
}

//////////////////// Finding property declaration refs & defs ////////////////////

/**
 * Finds references and/or definitions of a ScopedPropertyDeclarationId throughout a class.
 * 
 * The ScopedPropertyDeclarationId always refers to a class property.
 * 
 * @param scopedId The property declaration id to find references and/or definitions for
 * @param codeInfo The code info for the file containing the property declaration id
 * @param resultType Determines whether to return references, definitions, or both
 * @returns Locations of references, definitions, or both, depending on the {@link resultType}
 */
function findPropertyDeclarationRefsOrDefs (
    scopedId: ScopedPropertyDeclarationId, codeInfo: MatlabCodeInfo, resultType: ResultType
): Location[] | RefsAndDefsResult {
    const needRefs = resultType !== ResultType.Definitions
    const needDefs = resultType !== ResultType.References

    let fileScopedRefs: FileScopedIdentifier[] | undefined = needRefs ? [] : undefined
    let fileScopedDefs: FileScopedIdentifier[] | undefined = needDefs ? [] : undefined

    sweepAndAccumulatePropertyRefsOrDefs(fileScopedRefs, fileScopedDefs, scopedId.scope.classInfo, scopedId.id.name)

    return dottedPropertyIdentifierNarrowCombineAndFormat(
        fileScopedRefs, fileScopedDefs, Location.create(codeInfo.uri, scopedId.id.range), scopedId, resultType
    )
}

//////////////////// Finding function declaration refs & defs ////////////////////

/**
 * Finds references and/or definitions of a ScopedFunctionDeclarationId.
 * 
 * The ScopedFunctionDeclarationId may refer to a function or a method. If it refers to
 * a function, references and/or definitions will be found throughout the file. If it
 * refers to a method, references and/or definitions will be found throughout the
 * associated class.
 * 
 * @param scopedId The function declaration id to find references and/or definitions for
 * @param codeInfo The code info for the file containing the function declaration id
 * @param resultType Determines whether to return references, definitions, or both
 * @returns Locations of references, definitions, or both, depending on the {@link resultType}
 */
function findFunctionDeclarationRefsOrDefs (
    scopedId: ScopedFunctionDeclarationId, codeInfo: MatlabCodeInfo, resultType: ResultType
): Location[] | RefsAndDefsResult {
    if (scopedId.declaredFunctionScope.functionInfo.isConstructor) {
        return findClassRefsOrDefs(scopedId.id.name, codeInfo, resultType)
    }

    const isMethod = scopedId.declaredFunctionScope.functionInfo.isMethod

    const needRefs = resultType !== ResultType.Definitions

    const fileScopedRefs: FileScopedIdentifier[] | undefined = needRefs ? [] : undefined

    const defs: Location[] = [Location.create(codeInfo.uri, scopedId.id.range)]

    if (fileScopedRefs) {
        if (isMethod) {
            sweepAndAccumulateFunctionlikeReferencesEntry(
                fileScopedRefs, codeInfo.associatedClassInfo!, scopedId.id.name, FunctionlikeType.Method,
                scopedId.declaredFunctionScope.functionInfo.isStaticMethod
            )
        } else {
            sweepAndAccumulateFunctionlikeReferencesEntry(
                fileScopedRefs, functionParentScopeToFunctionContainer(scopedId.declaredFunctionScope.parentScope),
                scopedId.id.name, FunctionlikeType.Function
            )
        }
    }

    return dottedFunctionlikeIdentifierNarrowCombineAndFormat(fileScopedRefs, defs, scopedId, isMethod, resultType)
}

///////////////////// Finding function or unbound refs & defs /////////////////////
// (the first component of the selected identifier
// is a function or unbound reference)

/**
 * Finds references and/or definitions of a ScopedFunctionOrUnboundReference.
 * 
 * The ScopedFunctionOrUnboundReference may refer to a function, a presumably unbound
 * reference, or a method. If it refers to a function or a presumably unbound
 * reference, references and/or definitions will be found throughout the file. If it
 * refers to a method, references and/or definitions will be found throughout the
 * associated class.
 * 
 * @param scopedId The function or unbound reference to find references and/or definitions for
 * @param codeInfo The code info for the file containing the function or unbound reference
 * @param resultType Determines whether to return references, definitions, or both
 * @returns Locations of references, definitions, or both, depending on the {@link resultType}
 */
function findFunctionOrUnboundRefsOrDefs (
    scopedId: ScopedFunctionOrUnboundReference, codeInfo: MatlabCodeInfo, resultType: ResultType
): Location[] | RefsAndDefsResult {
    const needRefs = resultType !== ResultType.Definitions

    const fileScopedRefs: FileScopedIdentifier[] | undefined = needRefs ? [] : undefined
    const defs: Location[] = []

    const refsOrDefsType = accumulateFunctionOrUnboundRefsOrDefsNoDefFound(
        fileScopedRefs, defs, scopedId.scope, scopedId.id, codeInfo, false, false
    )

    return dottedFunctionlikeIdentifierNarrowCombineAndFormat(
        fileScopedRefs, defs, scopedId, refsOrDefsType === FunctionlikeType.Method, resultType
    )
}

/**
 * Accumulates the references and/or definitions of a function or unbound identifier.
 * 
 * This function does not take into account dotted identifier narrowing.
 * 
 * Important notes:
 *   - This function traverses the code info tree *upwards*. The initial call should have
 *     {@link scopedId} set to the scope containing the function or unbound identifier. The
 *     scope will expand as needed from there to get all references and/or definitions
 *     throughout the full scope necessary (the file if referring to a function or a
 *     presumably unbound identifier, or the associated class if referring to a method).
 *   - The function/method declaration id is not accumulated into the references array. This
 *     identifier, accumulated into the definitions array, should be added as a reference by
 *     the caller if needed.
 * 
 * @param fileScopedRefs Array to accumulate references in, or undefined if references are not needed
 *     (see above)
 * @param defs Array to accumulate definitions in
 * @param currentScope The current scope in the traversal (see above)
 * @param id The function or unbound identifier to find references and/or definitions for
 * @param codeInfo The code info for the file containing the identifier
 * @param firstArgIdDeclarationFound Whether a declaration for the identifier's first argument id has
 *     been found (should initially be false; used to help determine whether the identifier could be
 *     a method call)
 * @param presumedClassInstanceFound Whether the identifier's first argument id has been found to be
 *     a presumed class instance (should initially be false; used to help determine whether the
 *     identifier could be a method call)
 * @returns Whether the identifier refers to a function, presumably unbound identifier, or method
 */
function accumulateFunctionOrUnboundRefsOrDefsNoDefFound (
    fileScopedRefs: FileScopedIdentifier[] | undefined, defs: Location[], currentScope: FunctionParentScope,
    id: FunctionOrUnboundIdentifier, codeInfo: MatlabCodeInfo, firstArgIdDeclarationFound: boolean,
    presumedClassInstanceFound: boolean
): FunctionlikeType {
    if (currentScope instanceof MatlabGlobalScopeInfo) {
        return accumulateFunctionOrUnboundRefsOrDefsNoDefFoundGlobalScope(
            fileScopedRefs, defs, currentScope, id, codeInfo, presumedClassInstanceFound
        )
    } else if (currentScope instanceof MatlabClassdefInfo) {
        return accumulateFunctionOrUnboundRefsOrDefsNoDefFoundGlobalScope(
            fileScopedRefs, defs, currentScope.parentScope, id, codeInfo, presumedClassInstanceFound
        )
    } else { // MatlabFunctionScopeInfo
        const declarationId: NamedRange | undefined =
            currentScope.functionScopes.get(id.components[0].name)?.functionScopeInfo?.declarationNameId

        // If the function is declared in the current scope
        if (declarationId) {
            defs.push(Location.create(codeInfo.uri, declarationId.range))

            if (fileScopedRefs) {
                sweepAndAccumulateFunctionlikeReferencesEntry(
                    fileScopedRefs, currentScope, id.components[0].name, FunctionlikeType.Function
                )
            }

            return FunctionlikeType.Function
        } else {
            // If it is possible for the identifier to be a
            // function-syntax method call
            if (id.firstArgIdName && !firstArgIdDeclarationFound) {
                if (isDirectPresumedClassInstance(id.firstArgIdName, currentScope)) {
                    // If we are in a method's top-level scope
                    // and the first argument of the identifier/call
                    // is determined to be a presumed class instance,
                    // we mark presumedClassInstanceFound as true so
                    // we know the identifier might be a method call
                    firstArgIdDeclarationFound = true
                    presumedClassInstanceFound = true
                } else {
                    if (functionScopeHasShadowingDeclaration(currentScope, id.firstArgIdName, true)) {
                        // If the first arg id is in a shadowing declaration
                        // (function parameter or global declaration) that
                        // does not make it a presumed class instance, it
                        // is no longer possible for it to be designated a
                        // presumed class instance - e.g., if a method
                        // establishes obj as a presumed class instance, a
                        // nested function declaring obj as a parameter will
                        // shadow the presumed class instance, so if we find
                        // the nested function's parameter declaration while
                        // traversing up we will need to ignore the method's
                        // parameter declaration when we encounter it later
                        firstArgIdDeclarationFound = true
                    }
                }
            }

            return accumulateFunctionOrUnboundRefsOrDefsNoDefFound(
                fileScopedRefs, defs, currentScope.parentScope, id, codeInfo, firstArgIdDeclarationFound, presumedClassInstanceFound
            )
        }
    }
}

/**
 * Helper for {@link accumulateFunctionOrUnboundRefsOrDefsNoDefFound} to handle
 * the case where {@link currentScope} is a global scope.
 */
function accumulateFunctionOrUnboundRefsOrDefsNoDefFoundGlobalScope (
    fileScopedRefs: FileScopedIdentifier[] | undefined, defs: Location[], currentScope: MatlabGlobalScopeInfo,
    id: FunctionOrUnboundIdentifier, codeInfo: MatlabCodeInfo, presumedClassInstanceFound: boolean
): FunctionlikeType {
    const declarationId: NamedRange | undefined =
        currentScope.functionScopes.get(id.components[0].name)?.functionScopeInfo?.declarationNameId
    
    let sweepFunctionlikeType: FunctionlikeType
    
    // Note that local function calls take precedence
    // over function-syntax method calls
    if (declarationId) {
        defs.push(Location.create(codeInfo.uri, declarationId.range))

        sweepFunctionlikeType = FunctionlikeType.Function
    } else {
        let referencedMethod: MatlabFunctionInfo | undefined

        if (presumedClassInstanceFound) {
            referencedMethod = currentScope.codeInfo.associatedClassInfo?.functionScopes.get(id.components[0].name)
        }

        // Static methods cannot be called using function syntax.
        // Constructor calls are considered class references when
        // in the classdef file, but should be treated as unbound
        // references if in a supplementary method file.
        if (referencedMethod && !referencedMethod.isStaticMethod && !referencedMethod.isConstructor) {
            const methodScopeInfo: MatlabFunctionScopeInfo | undefined = referencedMethod.functionScopeInfo
            if (methodScopeInfo) {
                defs.push(Location.create(getUri(methodScopeInfo), methodScopeInfo.declarationNameId.range))
            }
            
            sweepFunctionlikeType = FunctionlikeType.Method
        } else {
            sweepFunctionlikeType = FunctionlikeType.Unbound
        }
    }

    if (fileScopedRefs) {
        sweepAndAccumulateFunctionlikeReferencesEntry(
            fileScopedRefs,
            sweepFunctionlikeType === FunctionlikeType.Method ? codeInfo.associatedClassInfo! : currentScope,
            id.components[0].name, sweepFunctionlikeType, false
        )
    }

    return sweepFunctionlikeType
}

////////////////// Finding var refs & defs /////////////////////
// (the first component of the selected identifier is a
// variable reference)

/**
 * Finds references and/or definitions of a ScopedVariableReference.
 * 
 * The ScopedVariableReference may refer to a variable (including structs), a
 * method, or a class property. If it refers to a variable, references and/or
 * definitions will be found throughout the file. If it refers to a method or
 * class property, references and/or definitions will be found throughout the
 * associated class.
 * 
 * @param scopedId The variable reference to find references and/or definitions for
 * @param codeInfo The code info for the file containing the variable reference
 * @param resultType Determines whether to return references, definitions, or both
 * @returns Locations of references, definitions, or both, depending on the {@link resultType}
 */
function findVarSourcedRefsOrDefs (
    scopedId: ScopedVariableReference, codeInfo: MatlabCodeInfo, resultType: ResultType
): Location[] | RefsAndDefsResult {
    const rawResult: VarSourcedRefsOrDefs = findVarSourcedRefsOrDefsHelper(scopedId, codeInfo, resultType)

    switch (rawResult.type) {
        case VarSourcedReferenceType.Method:
            return dottedFunctionlikeIdentifierNarrowCombineAndFormat(
                rawResult.refs, rawResult.defs, scopedId, true, resultType
            )
        case VarSourcedReferenceType.Property:
            return dottedPropertyIdentifierNarrowCombineAndFormat(
                rawResult.refs, rawResult.defs, rawResult.declaration, scopedId, resultType
            )
        case VarSourcedReferenceType.Variable:
            const needRefs = resultType !== ResultType.Definitions
            const needDefs = resultType !== ResultType.References

            let refs: Location[] | undefined
            let defs: Location[] | undefined

            if (needRefs) {
                refs = dottedIdentifierNarrow(
                    rawResult.refs!, scopedId.id.components, scopedId.selectedComponentIndex, false
                )
            }

            if (needDefs) {
                defs = dottedIdentifierNarrow(
                    rawResult.defs!, scopedId.id.components, scopedId.selectedComponentIndex, false
                )
            }

            return formatRefsOrDefsResult(refs, defs, resultType)
    }
}

enum VarSourcedReferenceType {
    Variable,
    Method,
    Property
}

interface VarSourcedVariableRefsOrDefs {
    type: VarSourcedReferenceType.Variable
    refs?: FileScopedIdentifier[]
    defs?: FileScopedIdentifier[]
}

interface VarSourcedMethodRefsOrDefs {
    type: VarSourcedReferenceType.Method
    refs?: FileScopedIdentifier[]
    defs: Location[]
}

interface VarSourcedPropertyRefsOrDefs {
    type: VarSourcedReferenceType.Property
    refs?: FileScopedIdentifier[]
    defs?: FileScopedIdentifier[]
    declaration: Location
}

type VarSourcedRefsOrDefs =
    | VarSourcedVariableRefsOrDefs
    | VarSourcedMethodRefsOrDefs
    | VarSourcedPropertyRefsOrDefs

/**
 * Helper for {@link findVarSourcedRefsOrDefs} that returns a raw result.
 * 
 * Take note of the following for the raw result:
 *   - Dotted identifier narrowing is not taken into account.
 *   - If {@link scopedId} refers to a method, the method declaration id is not returned
 *     in the references array. This identifier, returned in the definitions array,
 *     should be added as a reference by the caller if needed.
 *   - If {@link scopedId} refers to a property, the property declaration id is not returned
 *     in the references or definitions array. This identifier, returned separately as
 *     the declaration, should be added as a reference/definition by the caller if needed.
 */
function findVarSourcedRefsOrDefsHelper (
    scopedId: ScopedVariableReference, codeInfo: MatlabCodeInfo, resultType: ResultType
): VarSourcedRefsOrDefs {
    const needRefs = resultType !== ResultType.Definitions

    // Note: We always need to look for defs if the var
    // sourced reference type is Method, because we
    // will need to add the method declaration into
    // the references array (the parsed code data's
    // function and unbound references does not include
    // function declarations)
    const needDefsVariableOrProperty = resultType !== ResultType.References

    const firstComponentName: string = scopedId.id.components[0].name

    if (scopedId.scope instanceof MatlabGlobalScopeInfo) {
        if (scopedId.scope.globals.has(firstComponentName)) {
            return getGlobalVarRefsOrDefs(codeInfo, firstComponentName, needRefs, needDefsVariableOrProperty)
        } else {
            return getScriptLevelVarRefsOrDefs(
                scopedId.scope, firstComponentName, codeInfo.uri, needRefs, needDefsVariableOrProperty
            )
        }
    } else { // MatlabFunctionScopeInfo
        // Unless we find a shadowing declaration (function
        // parameter or global declaration), the goal is to
        // determine the widest function scope that is an
        // ancestor of the original identifier's scope and
        // which contains a definition of the identifier;
        // this is where we need to start the sweep for
        // refs/defs

        let sweepSourceScope: MatlabFunctionScopeInfo = scopedId.scope

        for (let currentScope: FunctionParentScope = scopedId.scope;
            currentScope instanceof MatlabFunctionScopeInfo;
            currentScope = currentScope.parentScope)
        {
            if (functionScopeHasShadowingDeclaration(currentScope, firstComponentName, true)) {
                if (isDirectPresumedClassInstance(firstComponentName, currentScope) && scopedId.selectedComponentIndex > 0) {
                    const potentialClassMemberName = scopedId.id.components[1].name

                    const referencedProperty: NamedRange | undefined =
                        codeInfo.associatedClassInfo?.properties.get(potentialClassMemberName)

                    if (referencedProperty) {
                        return getVarSourcedPropertyRefsOrDefs(
                            Location.create(
                                getUri(codeInfo.associatedClassInfo!.classdefInfo!),
                                referencedProperty.range
                            ), potentialClassMemberName, codeInfo, needRefs, needDefsVariableOrProperty
                        )
                    }

                    const referencedMethod: MatlabFunctionInfo | undefined =
                        codeInfo.associatedClassInfo?.functionScopes.get(potentialClassMemberName)

                    if (referencedMethod && !referencedMethod.isConstructor) {
                        return getVarSourcedMethodRefsOrDefs(
                            referencedMethod, potentialClassMemberName, codeInfo, needRefs
                        )
                    }
                }
                
                if (currentScope.globals.has(firstComponentName)) {
                    return getGlobalVarRefsOrDefs(codeInfo, firstComponentName, needRefs, needDefsVariableOrProperty)
                }

                // If the variable is declared as a function parameter
                // or global variable, this shadows any variable at a
                // broader scope, so if we're not looking for property,
                // method, or global variable refs/defs, start the
                // sweep for refs/defs at the current scope

                sweepSourceScope = currentScope
                break
            }

            if ((currentScope.variables.get(firstComponentName)?.definitions.length ?? 0) > 0) {
                sweepSourceScope = currentScope
            }
        }

        return getVarRefsOrDefsFromFunctionSweep(
            sweepSourceScope, firstComponentName, codeInfo.uri, needRefs, needDefsVariableOrProperty
        )
    }
}

/**
 * Finds the references and/or definitions of a variable reference referring to a class property.
 * 
 * The references and definitions will not include the property declaration, which will
 * be returned separately. Dotted identifier narrowing is not taken into account.
 * 
 * @param propertyDeclaration The location of the property's declaration
 * @param propertyName The name of the property to find references and/or definitions for
 * @param codeInfo The code info for the file containing the original variable reference
 * @param needRefs Whether to collect references to the property
 * @param needDefs Whether to collect definitions of the property
 * @returns Information about the property's declaration and references and/or definitions
 */
function getVarSourcedPropertyRefsOrDefs (
    propertyDeclaration: Location, propertyName: string, codeInfo: MatlabCodeInfo, needRefs: boolean, needDefs: boolean
): VarSourcedPropertyRefsOrDefs {
    const fileScopedRefs: FileScopedIdentifier[] | undefined = needRefs ? [] : undefined
    const fileScopedDefs: FileScopedIdentifier[] | undefined = needDefs ? [] : undefined
    
    sweepAndAccumulatePropertyRefsOrDefs(fileScopedRefs, fileScopedDefs, codeInfo.associatedClassInfo!, propertyName)

    return {
        type: VarSourcedReferenceType.Property,
        refs: fileScopedRefs,
        defs: fileScopedDefs,
        declaration: propertyDeclaration
    }
}

/**
 * Finds the references and/or definitions of a variable reference referring to a method.
 * 
 * The references will not include the method declaration, which will be returned as a
 * definition. Dotted identifier narrowing is not taken into account.
 * 
 * @param methodInfo The method's function info
 * @param methodName The name of the method to find references and/or definitions for
 * @param codeInfo The code info for the file containing the original variable reference
 * @param needRefs Whether to collect references to the method
 * @returns Information about the method's definitions and, optionally, references
 */
function getVarSourcedMethodRefsOrDefs (
    methodInfo: MatlabFunctionInfo, methodName: string, codeInfo: MatlabCodeInfo,
    needRefs: boolean
): VarSourcedMethodRefsOrDefs {
    const fileScopedRefs: FileScopedIdentifier[] | undefined = needRefs ? [] : undefined
    const defs: Location[] = []

    const methodScopeInfo = methodInfo.functionScopeInfo

    if (methodScopeInfo) {
        defs.push(Location.create(getUri(methodScopeInfo), methodScopeInfo.declarationNameId.range))
    }

    if (fileScopedRefs) {
        sweepAndAccumulateFunctionlikeReferencesEntry(
            fileScopedRefs, codeInfo.associatedClassInfo!, methodName, FunctionlikeType.Method,
            methodInfo.isStaticMethod
        )
    }

    return {
        type: VarSourcedReferenceType.Method,
        refs: fileScopedRefs,
        defs: defs
    }
}

/**
 * Finds the references and/or definitions of a variable reference referring to a non-global, script-level variable.
 * 
 * Dotted identifier narrowing is not taken into account.
 * 
 * @param scope The global scope containing the variable reference
 * @param firstComponentName The name of the first component of the variable reference to find
 *     references and/or definitions for
 * @param uri The URI of the file containing the variable reference
 * @param needRefs Whether to collect references to the variable
 * @param needDefs Whether to collect definitions of the variable
 * @returns Information about the variable's references and/or definitions
 */
function getScriptLevelVarRefsOrDefs (
    scope: MatlabGlobalScopeInfo, firstComponentName: string, uri: string, needRefs: boolean, needDefs: boolean
): VarSourcedVariableRefsOrDefs {
    const res: VarSourcedVariableRefsOrDefs = { type: VarSourcedReferenceType.Variable }

    if (needRefs) {
        res.refs = getFileScopedReferencesForFirstComponentName(scope.variables, firstComponentName, uri)
    }

    if (needDefs) {
        res.defs = getFileScopedVariableDefinitionsForFirstComponentName(scope.variables, firstComponentName, uri)
    }
    
    return res
}

/**
 * Finds the references and/or definitions of a variable reference referring to a non-global, function-scoped variable.
 * 
 * Dotted identifier narrowing is not taken into account.
 * 
 * @param sweepSourceScope The function scope for which all of its nested scopes in which the variable
 *     is not shadowed by a function parameter or global declaration can contain references to the
 *     variable, and no other scopes can contain references to the variable
 * @param firstComponentName The name of the first component of the variable reference to find
 *     references and/or definitions for
 * @param uri The URI of the file containing the variable reference
 * @param needRefs Whether to collect references to the variable
 * @param needDefs Whether to collect definitions of the variable
 * @returns Information about the variable's references and/or definitions
 */
function getVarRefsOrDefsFromFunctionSweep (
    sweepSourceScope: MatlabFunctionScopeInfo, firstComponentName: string, uri: string, needRefs: boolean,
    needDefs: boolean
): VarSourcedVariableRefsOrDefs {
    const fileScopedRefs: FileScopedIdentifier[] | undefined = needRefs ? [] : undefined
    const fileScopedDefs: FileScopedIdentifier[] | undefined = needDefs ? [] : undefined

    sweepAndAccumulateVarRefsOrDefs(fileScopedRefs, fileScopedDefs, sweepSourceScope, firstComponentName, uri)

    return {
        type: VarSourcedReferenceType.Variable,
        refs: fileScopedRefs,
        defs: fileScopedDefs
    }
}

/**
 * Finds the references and/or definitions of a variable reference referring to a global variable.
 * 
 * Dotted identifier narrowing is not taken into account.
 * 
 * @param codeInfo The code info for the file containing the variable reference
 * @param firstComponentName The name of the first component of the variable reference to find
 *     references and/or definitions for
 * @param needRefs Whether to collect references to the variable
 * @param needDefs Whether to collect definitions of the variable
 * @returns Information about the variable's references and/or definitions
 */
function getGlobalVarRefsOrDefs (
    codeInfo: MatlabCodeInfo, firstComponentName: string, needRefs: boolean, needDefs: boolean
): VarSourcedVariableRefsOrDefs {
    const fileScopedRefs: FileScopedIdentifier[] | undefined = needRefs ? [] : undefined
    const fileScopedDefs: FileScopedIdentifier[] | undefined = needDefs ? [] : undefined

    sweepAndAccumulateGlobalVarRefsOrDefs(
        fileScopedRefs, fileScopedDefs, codeInfo.globalScopeInfo, firstComponentName, codeInfo.uri, false
    )

    return {
        type: VarSourcedReferenceType.Variable,
        refs: fileScopedRefs,
        defs: fileScopedDefs
    }
}

/**
 * Accumulates the references and/or definitions of a variable reference referring to a non-global, function-scoped variable.
 * 
 * This function "sweeps" down from the given scope, accumulating references and definitions from
 * that scope and any nested scopes in which the variable is not shadowed by a function parameter
 * or global declaration.
 * 
 * Dotted identifier narrowing is not taken into account.
 * 
 * @param refs Array to accumulate references in, or undefined if references are not needed
 * @param defs Array to accumulate definitions in, or undefined if definitions are not needed
 * @param scope The scope to sweep from
 * @param firstComponentName The name of the first component of the variable reference to find
 *     references and/or definitions for
 * @param uri The URI of the file containing the variable reference
 */
function sweepAndAccumulateVarRefsOrDefs (
    refs: FileScopedIdentifier[] | undefined, defs: FileScopedIdentifier[] | undefined, scope: MatlabFunctionScopeInfo,
    firstComponentName: string, uri: string
): void {
    refs?.push(...getFileScopedReferencesForFirstComponentName(scope.variables, firstComponentName, uri))
    defs?.push(...getFileScopedVariableDefinitionsForFirstComponentName(scope.variables, firstComponentName, uri))

    for (const nestedFunction of scope.functionScopes.values()) {
        const nestedFunctionScope = nestedFunction.functionScopeInfo
        if (nestedFunctionScope && !functionScopeHasShadowingDeclaration(nestedFunctionScope, firstComponentName, true)) {
            sweepAndAccumulateVarRefsOrDefs(refs, defs, nestedFunctionScope, firstComponentName, uri)
        }
    }
}

/**
 * Accumulates the references and/or definitions of a variable reference referring to a global variable.
 * 
 * This function "sweeps" down from the given scope (which should initially be the global
 * scope) and accumulates only those references/definitions in the current scope and nested
 * scopes where the first component name of the variable in question is considered global.
 * 
 * Dotted identifier narrowing is not taken into account.
 * 
 * @param refs Array to accumulate references in, or undefined if references are not needed
 * @param defs Array to accumulate definitions in, or undefined if definitions are not needed
 * @param scope The scope to sweep from (should initially be the global scope containing the
 *     variable reference)
 * @param firstComponentName The name of the first component of the variable reference to find
 *     references and/or definitions for
 * @param uri The URI of the file containing the variable reference
 * @param declaredGlobalInFunction Whether {@link firstComponentName} has been declared global
 *     in a parent function scope (should initially be false)
 */
function sweepAndAccumulateGlobalVarRefsOrDefs (
    refs: FileScopedIdentifier[] | undefined, defs: FileScopedIdentifier[] | undefined, scope: FunctionContainer,
    firstComponentName: string, uri: string, declaredGlobalInFunction: boolean
): void {
    if (scope instanceof MatlabGlobalScopeInfo) {
        if (scope.globals.has(firstComponentName)) {
            refs?.push(...getFileScopedReferencesForFirstComponentName(scope.variables, firstComponentName, uri))
            defs?.push(...getFileScopedVariableDefinitionsForFirstComponentName(scope.variables, firstComponentName, uri))
        }

        if (scope.classScope) {
            sweepAndAccumulateGlobalVarRefsOrDefs(
                refs, defs, scope.classScope, firstComponentName, uri, declaredGlobalInFunction
            )
        }
    } else if (scope instanceof MatlabFunctionScopeInfo) {
        if (!declaredGlobalInFunction) {
            if (scope.globals.has(firstComponentName)) {
                declaredGlobalInFunction = true
            }
        } else {
            // It is not possible to declare a variable global
            // in a function, shadow it with a nested function
            // parameter, and then declare it global again in
            // a subsequent nested function
            if (functionScopeHasShadowingDeclaration(scope, firstComponentName, false)
                && !scope.globals.has(firstComponentName))
            {
                return
            }
        }

        if (declaredGlobalInFunction) {
            refs?.push(...getFileScopedReferencesForFirstComponentName(scope.variables, firstComponentName, uri))
            defs?.push(...getFileScopedVariableDefinitionsForFirstComponentName(scope.variables, firstComponentName, uri))
        }
    }

    // For MatlabGlobalScopeInfo, MatlabClassInfo, or MatlabFunctionScopeInfo
    for (const functionInfo of scope.functionScopes.values()) {
        if (functionInfo.functionScopeInfo) {
            sweepAndAccumulateGlobalVarRefsOrDefs(
                refs, defs, functionInfo.functionScopeInfo, firstComponentName, uri, declaredGlobalInFunction
            )
        }
    }
}

//////////////////// Finding property references & definitions ////////////////////
// (can be called from var-sourced refs/defs (if the
// selected identifier is a dot-syntax property reference)
// or property declaration refs/defs)

/**
 * Accumulates all references and/or definitions of a property in a given class.
 * 
 * The property declaration is not accumulated into the references or definitions.
 * Dotted identifier narrowing is not taken into account.
 * 
 * @param refs Array to accumulate references in, or undefined if references are not needed
 * @param defs Array to accumulate definitions in, or undefined if definitions are not needed
 * @param classInfo The class in which the property is defined
 * @param propertyName The name of the property to find references and/or definitions for
 */
function sweepAndAccumulatePropertyRefsOrDefs (
    refs: FileScopedIdentifier[] | undefined, defs: FileScopedIdentifier[] | undefined, classInfo: MatlabClassInfo,
    propertyName: string
): void {
    for (const method of classInfo.functionScopes.values()) {
        const methodFunctionScopeInfo: MatlabFunctionScopeInfo | undefined = method.functionScopeInfo
        
        if (methodFunctionScopeInfo) {
            const presumedClassInstanceName: string | null = getDirectPresumedClassInstanceName(methodFunctionScopeInfo)
            
            if (presumedClassInstanceName) {
                sweepAndAccumulatePropertyRefsOrDefsFunctionScope(
                    refs, defs, methodFunctionScopeInfo, propertyName, presumedClassInstanceName
                )
            }
        }
    }
}

/**
 * Accumulates the references and/or definitions of a property in a given function scope and its nested scopes.
 * 
 * This function "sweeps" down from the given scope, accumulating all references and
 * definitions to the property from that scope and any nested scopes.
 * 
 * Dotted identifier narrowing is not taken into account.
 * 
 * @param refs Array to accumulate references in, or undefined if references are not needed
 * @param defs Array to accumulate definitions in, or undefined if definitions are not needed
 * @param scope The scope to sweep from; should have a method scope with a presumed class
 *     instance name as an ancestor
 * @param propertyName The name of the property to find references and/or definitions for
 * @param presumedClassInstanceName The name established as a presumed class instance name by
 *     the method scope that {@link scope} is a descendant of
 */
function sweepAndAccumulatePropertyRefsOrDefsFunctionScope (
    refs: FileScopedIdentifier[] | undefined, defs: FileScopedIdentifier[] | undefined, scope: MatlabFunctionScopeInfo,
    propertyName: string, presumedClassInstanceName: string
): void {
    if (!scope.functionInfo.isMethod && functionScopeHasShadowingDeclaration(scope, presumedClassInstanceName, true)) {
        return
    }

    const scopeUri = getUri(scope)

    refs?.push(
        ...getFileScopedReferencesForFirstComponentName(
            scope.variables, presumedClassInstanceName, scopeUri, (id: Identifier) => (
                id.components.length >= 2 && id.components[1].name === propertyName
            )
        )
    )

    defs?.push(
        ...getFileScopedVariableDefinitionsForFirstComponentName(
            scope.variables, presumedClassInstanceName, scopeUri, (id: Identifier) => (
                id.components.length >= 2 && id.components[1].name === propertyName
            )
        )
    )

    for (const nestedFunction of scope.functionScopes.values()) {
        if (nestedFunction.functionScopeInfo) {
            sweepAndAccumulatePropertyRefsOrDefsFunctionScope(
                refs, defs, nestedFunction.functionScopeInfo, propertyName, presumedClassInstanceName
            )
        }
    }
}

//////////////////// Finding function-like references //////////////////////
// (i.e., finding the references of an existing function,
// an existing method, or an unbound identifier; can be
// called from var-sourced refs (if the selected identifier
// is a dot-syntax method call), function or unbound refs,
// or function declaration refs)

interface FileScopedIdentifier {
    uri: string
    identifier: Identifier
}

enum FunctionlikeType {
    Function,
    Unbound, // presumably unbound reference (could actually refer to a function or class defined in a different file)
    Method
}

interface FunctionlikeTypeParamsFunctionOption {
    type: FunctionlikeType.Function
    initialCall: boolean /** Whether this is the initial call to a sweepAndAccumulateFunctionlikeReferences helper */
}

interface FunctionlikeTypeParamsUnboundOption {
    type: FunctionlikeType.Unbound
    shadowingMethodFound: boolean /** Whether a method has been found that could potentially shadow certain references */
    presumedClassInstanceName: string | undefined /** Any name considered a presumed class instance */
}

interface FunctionlikeTypeParamsMethodOption {
    type: FunctionlikeType.Method
    /**
     * Whether identifiers that appear to be function-syntax
     * references to the method should be skipped, either
     * because a function with the same name was found that
     * can shadow the method for function-syntax calls or
     * because the method is static
     */
    skipFunctionSyntaxReferences: boolean
    presumedClassInstanceName: string | undefined /** Any name considered a presumed class instance */
}

type FunctionlikeTypeParams =
    | FunctionlikeTypeParamsFunctionOption
    | FunctionlikeTypeParamsUnboundOption
    | FunctionlikeTypeParamsMethodOption

/**
 * Entry point for accumulating the references of a function, presumably unbound reference, or method.
 * 
 * Dotted identifier narrowing is not taken into account.
 * 
 * @param fileScopedRefs The array to accumulate references into
 * @param scope The scope to start the sweep at:
 *       - For {@link functionlikeType} = {@link FunctionlikeType.Function}, this should be the parent
 *         scope of the scope of the function being *referred to* by the identifier to find references
 *         for
 *       - For {@link functionlikeType} = {@link FunctionlikeType.Unbound}, this should be the global
 *         scope containing the original presumably unbound identifier to find references for
 *       - For {@link functionlikeType} = {@link FunctionlikeType.Method}, this should be the
 *         associated class containing the method being referred to
 * @param idFirstComponentName The first component name of the entity referred to by the identifier
 *     to find references for (NOT the first component name of the identifier to find references for)
 *       - e.g., if finding references to a method "fun" this should always be "fun", regardless of
 *         whether the original identifier/identifier's expression was "fun(obj)" or "obj.fun"
 *       - e.g., if finding references to a presumably unbound reference "a.b.c" this should be "a"
 * @param functionlikeType The type of function-like entity referred to by the identifier to find
 *     references for (function, presumably unbound reference, or method); for Function or Method,
 *     the function/method must already have been verified to actually exist (in the file for
 *     Function or in the associated class for Method; if it does not exist, Unbound should be used
 *     instead)
 * @param isStaticMethod Whether the entity referred to by the identifier to find references for is
 *     a static method
 */
function sweepAndAccumulateFunctionlikeReferencesEntry (
    fileScopedRefs: FileScopedIdentifier[], scope: FunctionContainer, idFirstComponentName: string,
    functionlikeType: FunctionlikeType, isStaticMethod?: boolean
): void {
    let tp: FunctionlikeTypeParams

    switch (functionlikeType) {
        case FunctionlikeType.Function:
            tp = {
                type: functionlikeType,
                initialCall: true
            }
            break
        case FunctionlikeType.Unbound:
            tp = {
                type: functionlikeType,
                shadowingMethodFound: false,
                presumedClassInstanceName: undefined
            }
            break
        case FunctionlikeType.Method:
            tp = {
                type: functionlikeType,
                skipFunctionSyntaxReferences: !!isStaticMethod,
                presumedClassInstanceName: undefined
            }
            break
    }

    if (scope instanceof MatlabGlobalScopeInfo) {
        sweepAndAccumulateFunctionlikeReferencesGlobalScope(fileScopedRefs, scope, idFirstComponentName, tp)
    } else if (scope instanceof MatlabFunctionScopeInfo) {
        sweepAndAccumulateFunctionlikeReferencesFunctionScope(fileScopedRefs, scope, idFirstComponentName, tp)
    } else { // MatlabClassInfo
        sweepAndAccumulateFunctionlikeReferencesClass(fileScopedRefs, scope, idFirstComponentName, tp)
    }
}

/**
 * Helper for {@link sweepAndAccumulateFunctionlikeReferencesEntry} to handle the case
 * where {@link scope} is a global scope.
 * 
 * @param tp Holds different parameters needed by the algorithm depending on the
 *     {@link FunctionlikeType} of the entity referred to by the original identifier
 *     to find references for; see {@link FunctionlikeTypeParamsFunctionOption} and
 *     {@link FunctionlikeTypeParamsUnboundOption} for details. (In this helper, the
 *     {@link FunctionlikeType} should be {@link FunctionlikeType.Function} or
 *     {@link FunctionlikeType.Unbound})
 */
function sweepAndAccumulateFunctionlikeReferencesGlobalScope (
    fileScopedRefs: FileScopedIdentifier[], scope: MatlabGlobalScopeInfo, idFirstComponentName: string,
    tp: FunctionlikeTypeParams
): void {
    if (tp.type === FunctionlikeType.Unbound) {
        const potentialShadowingMethod =
            scope.codeInfo.associatedClassInfo?.functionScopes.get(idFirstComponentName)

        if (potentialShadowingMethod && !potentialShadowingMethod.isStaticMethod
            && !potentialShadowingMethod.isConstructor)
        {
            tp.shadowingMethodFound = true
        }
    }

    const scopeUri = getUri(scope)
    fileScopedRefs.push(
        ...getFileScopedReferencesForFirstComponentName(
            scope.functionOrUnboundReferences, idFirstComponentName, scopeUri
        )
    )

    if (scope.classScope) {
        sweepAndAccumulateFunctionlikeReferencesClass(
            fileScopedRefs, scope.classScope, idFirstComponentName,
            tp.type === FunctionlikeType.Function ? {...tp, initialCall: false} : {...tp}
        )
    }

    for (const functionInfo of scope.functionScopes.values()) {
        if (functionInfo.functionScopeInfo) {
            sweepAndAccumulateFunctionlikeReferencesFunctionScope(
                fileScopedRefs, functionInfo.functionScopeInfo, idFirstComponentName,
                tp.type === FunctionlikeType.Function ? {...tp, initialCall: false} : {...tp}
            )
        }
    }
}

/**
 * Helper for {@link sweepAndAccumulateFunctionlikeReferencesEntry} to handle the case
 * where {@link scope} is a function scope.
 * 
 * @param tp Holds different parameters needed by the algorithm depending on the
 *     {@link FunctionlikeType} of the entity referred to by the original identifier
 *     to find references for; see {@link FunctionlikeTypeParamsFunctionOption},
 *     {@link FunctionlikeTypeParamsUnboundOption}, and
 *     {@link FunctionlikeTypeParamsMethodOption} for details
 */
function sweepAndAccumulateFunctionlikeReferencesFunctionScope (
    fileScopedRefs: FileScopedIdentifier[], scope: MatlabFunctionScopeInfo, idFirstComponentName: string,
    tp: FunctionlikeTypeParams
): void {
    // Check shadowing
    if (scope.functionScopes.has(idFirstComponentName)) {
        if (tp.type === FunctionlikeType.Unbound || (tp.type === FunctionlikeType.Function && !tp.initialCall)) {
            return
        }
        if (tp.type === FunctionlikeType.Method) {
            tp.skipFunctionSyntaxReferences = true
        }
    }

    // Update presumed class instance name
    if (tp.type === FunctionlikeType.Unbound || tp.type === FunctionlikeType.Method) {
        if (!tp.presumedClassInstanceName) {
            tp.presumedClassInstanceName = getDirectPresumedClassInstanceName(scope) ?? undefined
        } else {
            if (functionScopeHasShadowingDeclaration(scope, tp.presumedClassInstanceName, true)) {
                if (tp.type === FunctionlikeType.Method) {
                    return
                }
                tp.presumedClassInstanceName = undefined
            }
        }
    }

    let functionSyntaxCallFilterPredicate: (id: FunctionOrUnboundIdentifier) => boolean
    switch (tp.type) {
        case FunctionlikeType.Function:
            functionSyntaxCallFilterPredicate = () => true
            break
        case FunctionlikeType.Unbound:
            functionSyntaxCallFilterPredicate = (id) => (
                !tp.shadowingMethodFound || !id.firstArgIdName || (id.firstArgIdName !== tp.presumedClassInstanceName)
            )
            break
        case FunctionlikeType.Method:
            functionSyntaxCallFilterPredicate = (id) => (
                !!id.firstArgIdName && (id.firstArgIdName === tp.presumedClassInstanceName)
            )
            break
    }

    const scopeUri = getUri(scope)

    // Function-syntax calls
    if (!(tp.type === FunctionlikeType.Method && tp.skipFunctionSyntaxReferences)) {
        fileScopedRefs.push(
            ...getFileScopedReferencesForFirstComponentName(
                scope.functionOrUnboundReferences, idFirstComponentName, scopeUri, functionSyntaxCallFilterPredicate
            )
        )
    }

    // Dot-syntax calls
    if (tp.type === FunctionlikeType.Method && tp.presumedClassInstanceName) {
        fileScopedRefs.push(
            ...getFileScopedReferencesForFirstComponentName(
                scope.variables, tp.presumedClassInstanceName, scopeUri, (id: Identifier) => (
                    id.components.length >= 2 && id.components[1].name === idFirstComponentName
                )
            )
        )
    }

    for (const nestedFunction of scope.functionScopes.values()) {
        if (nestedFunction.functionScopeInfo) {
            sweepAndAccumulateFunctionlikeReferencesFunctionScope(
                fileScopedRefs, nestedFunction.functionScopeInfo, idFirstComponentName,
                tp.type === FunctionlikeType.Function ? {...tp, initialCall: false} : {...tp}
            )
        }
    }
}

/**
 * Helper for {@link sweepAndAccumulateFunctionlikeReferencesEntry} to handle the case
 * where {@link scope} is a class.
 * 
 * @param tp Holds different parameters needed by the algorithm depending on the
 *     {@link FunctionlikeType} of the entity referred to by the original identifier
 *     to find references for; see {@link FunctionlikeTypeParamsFunctionOption},
 *     {@link FunctionlikeTypeParamsUnboundOption}, and
 *     {@link FunctionlikeTypeParamsMethodOption} for details
 */
function sweepAndAccumulateFunctionlikeReferencesClass (
    fileScopedRefs: FileScopedIdentifier[], scope: MatlabClassInfo, idFirstComponentName: string,
    tp: FunctionlikeTypeParams
): void {
    for (const method of scope.functionScopes.values()) {
        const methodFunctionScopeInfo: MatlabFunctionScopeInfo | undefined = method.functionScopeInfo
        if (!methodFunctionScopeInfo) {
            continue
        }

        // If we are looking for function or unbound references, the
        // original identifier must have been in a classdef file, and
        // we only want to consider method scopes in that same file in
        // that case
        if (tp.type === FunctionlikeType.Method || methodFunctionScopeInfo.parentScope instanceof MatlabClassdefInfo) {
            if (tp.type === FunctionlikeType.Function) {
                tp.initialCall = false
            }

            if (tp.type === FunctionlikeType.Method) {
                const potentialShadowingLocalFunction: MatlabFunctionInfo | undefined =
                    getGlobalScope(methodFunctionScopeInfo).functionScopes.get(idFirstComponentName)
                
                if (potentialShadowingLocalFunction && !potentialShadowingLocalFunction.isMethod) {
                    tp.skipFunctionSyntaxReferences = true
                }
            }

            sweepAndAccumulateFunctionlikeReferencesFunctionScope(
                fileScopedRefs, methodFunctionScopeInfo, idFirstComponentName, {...tp}
            )
        }
    }
}

//////////////////// Dotted identifier narrowing /////////////////////

/**
 * Performs dotted identifier narrowing on a collection of identifiers.
 * 
 * @param unnarrowedIds The collection of identifiers representing the unnarrowed
 *     references or definitions of a source identifier
 * @param adjustedScopedIdComponents The components of the source identifier, with
 *     the first component of a dot-syntax method or property reference omitted
 * @param adjustedSelectedComponentIndex The index of the selected component in
 *     {@link adjustedScopedIdComponents}
 * @param areMethodOrPropertyRefs Whether the references are of a method or class property (regardless
 *     of source identifier)
 * @returns Locations of the final references or definitions
 */
function dottedIdentifierNarrow (
    unnarrowedIds: FileScopedIdentifier[], adjustedScopedIdComponents: NamedRange[],
    adjustedSelectedComponentIndex: number, areMethodOrPropertyRefs: boolean
): Location[] {
    const finalLocations: Location[] = []

    for (const ref of unnarrowedIds) {
        let adjustedRefComponents: NamedRange[]

        if (areMethodOrPropertyRefs && ref.identifier.components.length > 1) {
            adjustedRefComponents = ref.identifier.components.slice(1)
        } else {
            adjustedRefComponents = ref.identifier.components
        }

        if (adjustedRefComponents.length > adjustedSelectedComponentIndex) {
            let isMatch = true

            for (let i = 1; i <= adjustedSelectedComponentIndex; i++) {
                if (adjustedRefComponents[i].name !== adjustedScopedIdComponents[i].name) {
                    isMatch = false
                    break
                }
            }

            if (isMatch) {
                finalLocations.push(Location.create(ref.uri, adjustedRefComponents[adjustedSelectedComponentIndex].range))
            }
        }
    }

    return finalLocations
}

/**
 * Finalizes the references and definitions of a function-like entity.
 * 
 * Performs dotted identifier narrowing, adds the declaration into the references list
 * if necessary, and formats the results.
 * 
 * @param refs The collection of identifiers representing the unnarrowed references
 *     of a source identifier, or undefined if references are not needed
 * @param defs The collection of identifiers representing the unnarrowed definitions
 *     of a source identifier
 * @param scopedId The source identifier of which references and/or definitions were
 *     collected
 * @param areForMethod Whether the references are of a method (regardless of source
 *     identifier)
 * @param resultType Determines whether to return references, definitions, or both
 * @returns Locations of the final references, definitions, or both, depending on
 *     the {@link resultType}
 */
function dottedFunctionlikeIdentifierNarrowCombineAndFormat (
    refs: FileScopedIdentifier[] | undefined, defs: Location[],
    scopedId: ScopedVariableReference | ScopedFunctionOrUnboundReference | ScopedFunctionDeclarationId,
    areForMethod: boolean, resultType: ResultType
): Location[] | RefsAndDefsResult {
    let finalRefs: Location[] | undefined
    let finalDefs: Location[]

    let adjustedScopedIdComponents: NamedRange[]
    let adjustedSelectedComponentIndex: number

    if (scopedId instanceof ScopedFunctionDeclarationId) {
        adjustedScopedIdComponents = [scopedId.id]
        adjustedSelectedComponentIndex = 0
    } else if (areForMethod && scopedId.id.components.length > 1) {
        adjustedScopedIdComponents = scopedId.id.components.slice(1)
        adjustedSelectedComponentIndex = scopedId.selectedComponentIndex - 1
    } else {
        adjustedScopedIdComponents = scopedId.id.components
        adjustedSelectedComponentIndex = scopedId.selectedComponentIndex
    }

    if (adjustedSelectedComponentIndex === 0) {
        finalDefs = defs
    } else {
        finalDefs = []
    }

    if (refs) {
        finalRefs = dottedIdentifierNarrow(
            refs, adjustedScopedIdComponents, adjustedSelectedComponentIndex, areForMethod
        )

        finalRefs.push(...finalDefs)
    }

    return formatRefsOrDefsResult(finalRefs, finalDefs, resultType)
}

/**
 * Finalizes the references and definitions of a class property.
 * 
 * Performs dotted identifier narrowing, adds the declaration into the references
 * and definitions lists if necessary, and formats the results.
 * 
 * @param refs The collection of identifiers representing the unnarrowed references
 *     of a source identifier, or undefined if references are not needed
 * @param defs The collection of identifiers representing the unnarrowed definitions
 *     of a source identifier, or undefined if definitions are not needed
 * @param declaration The location of the declaration of the property for which
 *     references and/or definitions were collected
 * @param scopedId The source identifier of which references and/or definitions were
 *     collected
 * @param resultType Determines whether to return references, definitions, or both
 * @returns Locations of the final references, definitions, or both, depending on
 *     the {@link resultType}
 */
function dottedPropertyIdentifierNarrowCombineAndFormat (
    refs: FileScopedIdentifier[] | undefined, defs: FileScopedIdentifier[] | undefined, declaration: Location,
    scopedId: ScopedVariableReference | ScopedPropertyDeclarationId, resultType: ResultType
): Location[] | RefsAndDefsResult {
    let finalRefs: Location[] | undefined
    let finalDefs: Location[] | undefined

    let adjustedScopedIdComponents: NamedRange[]
    let adjustedSelectedComponentIndex: number

    if (scopedId instanceof ScopedPropertyDeclarationId) {
        adjustedScopedIdComponents = [scopedId.id]
        adjustedSelectedComponentIndex = 0
    } else { // ScopedVariableReference
        // If we looked for property refs/defs from a variable
        // reference, the selected component index must be >= 1
        // and the first component must be a presumed class
        // instance
        adjustedScopedIdComponents = scopedId.id.components.slice(1)
        adjustedSelectedComponentIndex = scopedId.selectedComponentIndex - 1
    }

    if (refs) {
        finalRefs = dottedIdentifierNarrow(
            refs, adjustedScopedIdComponents, adjustedSelectedComponentIndex, true
        )

        if (adjustedSelectedComponentIndex === 0) {
            finalRefs.push(declaration)
        }
    }

    if (defs) {
        finalDefs = dottedIdentifierNarrow(
            defs, adjustedScopedIdComponents, adjustedSelectedComponentIndex, true
        )

        if (adjustedSelectedComponentIndex === 0) {
            finalDefs.push(declaration)
        }
    }

    return formatRefsOrDefsResult(finalRefs, finalDefs, resultType)
}

/////////////////////// Finding definitions on path using PathResolver ////////////////////

type ScopedOutsideReference = ClassReference | ScopedFunctionOrUnboundReference

async function findDefinitionsOnPathWithExpansion (
    scopedId: ScopedOutsideReference, sourceUri: string, pathResolver: PathResolver, indexer: Indexer,
    fileInfoIndex: FileInfoIndex
): Promise<Location[]> {
    let definitionUri: string | null = null
    let currentComponentIndex: number

    if (scopedId instanceof ClassReference) {
        definitionUri = await findDefinitionUriOnPath(scopedId.id.name, sourceUri, pathResolver)
    } else { // ScopedFunctionOrUnboundReference
        for (currentComponentIndex = scopedId.selectedComponentIndex;
            currentComponentIndex < scopedId.id.components.length;
            currentComponentIndex++)
        {
            const expressionToResolve: string = scopedId.id.components.slice(0, currentComponentIndex + 1)
                .map(component => component.name)
                .join('.')
            
            definitionUri = await findDefinitionUriOnPath(expressionToResolve, sourceUri, pathResolver)

            if (definitionUri) {
                break
            }
        }
    }

    if (!definitionUri) {
        return []
    }

    let unqualifiedDefinitionsTarget: string

    if (scopedId instanceof ClassReference) {
        unqualifiedDefinitionsTarget = scopedId.id.name.substring(scopedId.id.name.lastIndexOf('.') + 1)
    } else { // ScopedFunctionOrUnboundReference
        unqualifiedDefinitionsTarget = scopedId.id.components[currentComponentIndex!].name
    }

    const defLocations: Location[] | null = await findDefinitionsFromOutsideFile(
        unqualifiedDefinitionsTarget, definitionUri, indexer, fileInfoIndex
    )

    if (defLocations) {
        return defLocations
    }

    // If a specific definition location cannot be identified,
    // default to the beginning of the file. This could be the case
    // for builtin functions which don't actually have a definition
    // in a .m file (e.g. plot).
    return [Location.create(definitionUri, Range.create(0, 0, 0, 0))]
}

async function findDefinitionUriOnPath (
    expressionToResolve: string, sourceUri: string, pathResolver: PathResolver
): Promise<string | null> {
    const resolvedUri: string | null = await pathResolver.resolvePath(expressionToResolve, sourceUri)

    if (resolvedUri) {
        // Ensure URI is not a directory. This can occur with some packages.
        const fileStats = await fs.stat(URI.parse(resolvedUri).fsPath)
        if (!fileStats.isDirectory()) {
            return resolvedUri
        }
    }

    return null
}

async function findDefinitionsFromOutsideFile (
    unqualifiedDefinitionsTarget: string, definitionUri: string, indexer: Indexer, fileInfoIndex: FileInfoIndex
): Promise<Location[] | null> {
    if (!fileInfoIndex.codeInfoCache.has(definitionUri)) {
        // Index target file, if necessary
        await indexer.indexFile(definitionUri)
    }

    const defFileCodeInfo = fileInfoIndex.codeInfoCache.get(definitionUri)

    // Find definition location(s) within determined file
    if (defFileCodeInfo) {
        const defLocations: Location[] =
            findClassRefsOrDefs(unqualifiedDefinitionsTarget, defFileCodeInfo, ResultType.Definitions)

        if (defLocations.length > 0) {
            return defLocations
        }

        const matchingFunction: MatlabFunctionInfo | undefined =
            defFileCodeInfo.globalScopeInfo.functionScopes.get(unqualifiedDefinitionsTarget)
        
        if (matchingFunction?.isPublic && matchingFunction.functionScopeInfo) {
            return [Location.create(
                definitionUri, matchingFunction.functionScopeInfo.declarationNameId.range
            )]
        }
    }

    return null
}

///////////////////////////////// Helpers /////////////////////////////////

function getScopedIdAndCodeInfo (
    uri: string, position: Position, fileInfoIndex: FileInfoIndex, documentManager: TextDocuments<TextDocument>, requestType: RequestType
): [ScopedReference, MatlabCodeInfo] | null {
    const codeInfo: MatlabCodeInfo | undefined = fileInfoIndex.codeInfoCache.get(uri)
    if (codeInfo == null) {
        reportTelemetry(requestType, 'File not indexed')
        return null
    }

    const textDocument = documentManager.get(uri)
    if (textDocument == null) {
        reportTelemetry(requestType, 'No document')
        return null
    }

    const scopedId: ScopedReference | null = getIdentifierAtPosition(codeInfo, position)
    if (scopedId == null) {
        if (requestType !== RequestType.DocumentHighlight) {
            reportTelemetry(requestType, 'Target is not an identifier')
        }
        return null
    }

    return [scopedId, codeInfo]
}

function getGlobalScope (scope: FunctionParentScope): MatlabGlobalScopeInfo {
    if (scope instanceof MatlabGlobalScopeInfo) {
        return scope
    }

    return getGlobalScope(scope.parentScope)
}

function getUri (scope: FunctionParentScope): string {
    return getGlobalScope(scope).codeInfo.uri
}

function functionScopeHasShadowingDeclaration (
    scope: MatlabFunctionScopeInfo, firstComponentName: string, checkForGlobals: boolean
): boolean {
    return scope.inputArgs.has(firstComponentName)
        || scope.outputArgs.has(firstComponentName)
        || (checkForGlobals && scope.globals.has(firstComponentName))
}

function isDirectPresumedClassInstance (firstComponentName: string, functionScope: MatlabFunctionScopeInfo): boolean {
    return firstComponentName === getDirectPresumedClassInstanceName(functionScope)
}

function getDirectPresumedClassInstanceName (functionScope: MatlabFunctionScopeInfo): string | null {
    const functionInfo = functionScope.functionInfo

    if (functionInfo.isMethod && !functionInfo.isStaticMethod) {
        if (functionInfo.isConstructor) {
            const [firstOutputArgName] = functionScope.outputArgs
            return firstOutputArgName
        } else {
            const [firstInputArgName] = functionScope.inputArgs
            return firstInputArgName
        }
    }

    return null
}

function getFileScopedReferencesForFirstComponentName<T extends Identifier> (
    identifierMap: IdentifierMap<ReferenceInfo<T>>, firstComponentName: string, uri: string,
    identifierFilterPredicate?: (id: T) => boolean
): FileScopedIdentifier[] {
    return getFileScopedIdentifiersForFirstComponentName(
        identifierMap, firstComponentName, uri, (idInfo) => idInfo.references, identifierFilterPredicate
    )
}

function getFileScopedVariableDefinitionsForFirstComponentName (
    identifierMap: IdentifierMap<MatlabVariableInfo>, firstComponentName: string, uri: string,
    identifierFilterPredicate?: (id: Identifier) => boolean
): FileScopedIdentifier[] {
    return getFileScopedIdentifiersForFirstComponentName(
        identifierMap, firstComponentName, uri, (varInfo) => varInfo.definitions, identifierFilterPredicate
    )
}

function getFileScopedIdentifiersForFirstComponentName<IdentifierInfoT extends ReferenceInfo<any>, IdentifierT extends Identifier> (
    identifierMap: IdentifierMap<IdentifierInfoT>, firstComponentName: string, uri: string,
    identifierInfoToIdentifiersMapper: (idInfo: IdentifierInfoT) => IdentifierT[],
    identifierFilterPredicate: (id: IdentifierT) => boolean = () => true
): FileScopedIdentifier[] {
    const identifierInfo: IdentifierInfoT | undefined = identifierMap.get(firstComponentName)

    if (!identifierInfo) {
        return []
    }

    return identifierInfoToIdentifiersMapper(identifierInfo)
        .filter(identifierFilterPredicate)
        .map(id => ({
            uri,
            identifier: id
        }))
}

function functionParentScopeToFunctionContainer (functionParentScope: FunctionParentScope): FunctionContainer {
    if (functionParentScope instanceof MatlabClassdefInfo) {
        return functionParentScope.classInfo
    }
    return functionParentScope
}

function formatRefsOrDefsResult (
    refs: Location[] | undefined, defs: Location[] | undefined, resultType: ResultType
): Location[] | RefsAndDefsResult {
    switch (resultType) {
        case ResultType.References:
            return refs!
        case ResultType.Definitions:
            return defs!
        case ResultType.All:
            return { references: refs!, definitions: defs! }
    }
}
