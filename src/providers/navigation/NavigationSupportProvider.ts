// Copyright 2022 - 2025 The MathWorks, Inc.

import { DefinitionParams, DocumentSymbolParams, Location, Range, ReferenceParams, SymbolInformation, SymbolKind, TextDocuments } from 'vscode-languageserver'
import { TextDocument } from 'vscode-languageserver-textdocument'
import FileInfoIndex, {
    FunctionContainer, MatlabClassdefInfo, MatlabClassInfo, MatlabCodeInfo, MatlabFunctionScopeInfo,
    MatlabGlobalScopeInfo
} from '../../indexing/FileInfoIndex'
import { MatlabConnection } from '../../lifecycle/MatlabCommunicationManager'
import LifecycleNotificationHelper from '../../lifecycle/LifecycleNotificationHelper'
import { ActionErrorConditions } from '../../logging/TelemetryUtils'
import { RequestType, reportTelemetry } from '../../indexing/SymbolSearchService'
import MatlabLifecycleManager from '../../lifecycle/MatlabLifecycleManager'
import Indexer from '../../indexing/Indexer'
import DocumentIndexer from '../../indexing/DocumentIndexer'
import PathResolver from './PathResolver'
import NotificationService, { Notification } from '../../notifications/NotificationService'
import * as SymbolSearchService from '../../indexing/SymbolSearchService'
import { DocumentUri } from 'vscode-languageserver-types'

class NavigationSupportProvider {
    constructor (
        protected matlabLifecycleManager: MatlabLifecycleManager,
        protected fileInfoIndex: FileInfoIndex,
        protected indexer: Indexer,
        protected documentIndexer: DocumentIndexer,
        protected pathResolver: PathResolver
    ) {}

    /**
     * Handles requests for definitions or references.
     *
     * @param params Parameters for the definition or references request
     * @param documentManager The text document manager
     * @param requestType The type of request (definition or references)
     * @returns An array of locations
     */
    async handleDefOrRefRequest (params: DefinitionParams | ReferenceParams, documentManager: TextDocuments<TextDocument>, requestType: RequestType): Promise<Location[]> {
        const matlabConnection = await this.matlabLifecycleManager.getMatlabConnection(true)
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

        await this.documentIndexer.ensureDocumentIndexIsUpdated(textDocument)

        if (requestType === RequestType.Definition) {
            return await SymbolSearchService.findDefinitions(
                uri, params.position, this.fileInfoIndex, documentManager, this.pathResolver, this.indexer, requestType
            )
        } else {
            return SymbolSearchService.findReferences(uri, params.position, this.fileInfoIndex, documentManager, requestType)
        }
    }

    /**
     *
     * @param params Parameters for the document symbol request
     * @param documentManager The text document manager
     * @param requestType The type of request
     * @returns Array of symbols found in the document
     */
    async handleDocumentSymbol (uri: DocumentUri, documentManager: TextDocuments<TextDocument>, requestType: RequestType): Promise<SymbolInformation[]> {
        // Get or wait for the MATLAB connection to handle files opened before MATLAB is ready.
        // We do not want to trigger MATLAB to launch due to the frequency of this callback.
        // However, simply returning [] in this case could cause a delay between MATLAB started
        // and the symbols being identified.
        // eslint-disable-next-line no-async-promise-executor
        const matlabConnection = await new Promise<MatlabConnection | null>(async resolve => {
            if (this.matlabLifecycleManager.isMatlabConnected()) {
                resolve(await this.matlabLifecycleManager.getMatlabConnection())
            } else {
                // MATLAB is not already connected, so wait until it has connected to
                // resolve the connection.
                this.matlabLifecycleManager.eventEmitter.once('connected', async () => {
                    resolve(await this.matlabLifecycleManager.getMatlabConnection())
                })
            }
        })

        if (matlabConnection == null) {
            reportTelemetry(requestType, ActionErrorConditions.MatlabUnavailable)
            return []
        }

        const textDocument = documentManager.get(uri)

        if (textDocument == null) {
            reportTelemetry(requestType, 'No document')
            return []
        }

        await this.documentIndexer.ensureDocumentIndexIsUpdated(textDocument)

        const codeInfo = this.fileInfoIndex.codeInfoCache.get(uri)
        if (codeInfo == null) {
            reportTelemetry(requestType, 'No code data')
            return []
        }

        // Result symbols in document
        const result: SymbolInformation[] = []

        /**
         * Push symbol info to result set
         */
        function pushSymbol (name: string, kind: SymbolKind, symbolRange: Range): void {
            result.push(SymbolInformation.create(name, kind, symbolRange, uri))
        }

        const classdef: MatlabClassdefInfo | undefined = codeInfo.globalScopeInfo.classScope?.classdefInfo
        if (classdef) {
            pushSymbol(classdef.declarationNameId.name, SymbolKind.Class, classdef.range)

            const classInfo = classdef.classInfo

            classInfo.enumerations.forEach(enumInfo => pushSymbol(enumInfo.name, SymbolKind.EnumMember, enumInfo.range))
            classInfo.properties.forEach(propInfo => pushSymbol(propInfo.name, SymbolKind.Property, propInfo.range))
            classdef.methodsBlocks.forEach(blockInfo => pushSymbol(blockInfo.name, SymbolKind.Method, blockInfo.range))
            classdef.enumerationsBlocks.forEach(blockInfo => pushSymbol(blockInfo.name, SymbolKind.EnumMember, blockInfo.range))
            classdef.propertiesBlocks.forEach(blockInfo => pushSymbol(blockInfo.name, SymbolKind.Property, blockInfo.range))
        }

        this._getAllFunctionScopesInFile(codeInfo).forEach(functionScopeInfo => pushSymbol(
            functionScopeInfo.declarationNameId.name,
            functionScopeInfo.functionInfo.isMethod ? SymbolKind.Method : SymbolKind.Function,
            functionScopeInfo.range
        ))

        codeInfo.sections.forEach(sectionInfo => {
            if (sectionInfo.isExplicit) {
                pushSymbol(sectionInfo.name, SymbolKind.Module, sectionInfo.range)
            }
        })

        this._sendSectionRangesForHighlighting(codeInfo, uri)

        return result
    }

    private _getAllFunctionScopesInFile (codeInfo: MatlabCodeInfo): MatlabFunctionScopeInfo[] {
        const functionScopes: MatlabFunctionScopeInfo[] = []
        this._getAllFunctionScopesInFileAcc(codeInfo.globalScopeInfo, functionScopes)
        return functionScopes
    }

    private _getAllFunctionScopesInFileAcc (scope: FunctionContainer, functionScopes: MatlabFunctionScopeInfo[]): void {
        if (scope instanceof MatlabGlobalScopeInfo && scope.classScope) {
            this._getAllFunctionScopesInFileAcc(scope.classScope, functionScopes)
        }

        for (const functionInfo of scope.functionScopes.values()) {
            const functionScopeInfo = functionInfo.functionScopeInfo
            if (functionScopeInfo && (!(scope instanceof MatlabClassInfo)
                                      || functionScopeInfo.parentScope instanceof MatlabClassdefInfo))
            {
                functionScopes.push(functionScopeInfo)
                this._getAllFunctionScopesInFileAcc(functionScopeInfo, functionScopes)
            }
        }
    }

    private _sendSectionRangesForHighlighting (codeInfo: MatlabCodeInfo, uri: string): void {
        const sectionRanges = codeInfo.sections.map(sectionData => (
            { range: sectionData.range, isExplicit: sectionData.isExplicit }
        ))
        NotificationService.sendNotification(Notification.MatlabSections, { uri, sectionRanges })
    }
}

export default NavigationSupportProvider
