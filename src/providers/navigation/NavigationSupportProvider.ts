// Copyright 2022 - 2025 The MathWorks, Inc.

import { DefinitionParams, DocumentSymbolParams, Location, Range, ReferenceParams, SymbolInformation, SymbolKind, TextDocuments } from 'vscode-languageserver'
import { TextDocument } from 'vscode-languageserver-textdocument'
import FileInfoIndex, { MatlabCodeData } from '../../indexing/FileInfoIndex'
import { MatlabConnection } from '../../lifecycle/MatlabCommunicationManager'
import LifecycleNotificationHelper from '../../lifecycle/LifecycleNotificationHelper'
import { ActionErrorConditions } from '../../logging/TelemetryUtils'
import { getExpressionAtPosition } from '../../utils/ExpressionUtils'
import SymbolSearchService, { RequestType, reportTelemetry } from '../../indexing/SymbolSearchService'
import MatlabLifecycleManager from '../../lifecycle/MatlabLifecycleManager'
import Indexer from '../../indexing/Indexer'
import DocumentIndexer from '../../indexing/DocumentIndexer'
import PathResolver from './PathResolver'
import NotificationService, { Notification } from '../../notifications/NotificationService'

class NavigationSupportProvider {
    constructor (
        protected matlabLifecycleManager: MatlabLifecycleManager,
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

        // Find ID for which to find the definition or references
        const expression = getExpressionAtPosition(textDocument, params.position)

        if (expression == null) {
            // No target found
            reportTelemetry(requestType, 'No navigation target')
            return []
        }

        if (requestType === RequestType.Definition) {
            return await SymbolSearchService.findDefinition(uri, params.position, expression, this.pathResolver, this.indexer)
        } else {
            return SymbolSearchService.findReferences(uri, params.position, expression, documentManager, requestType)
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

        const uri = params.textDocument.uri
        const textDocument = documentManager.get(uri)

        if (textDocument == null) {
            reportTelemetry(requestType, 'No document')
            return []
        }
        // Ensure document index is up to date
        await this.documentIndexer.ensureDocumentIndexIsUpdated(textDocument)
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
            classInfo.enumerations.forEach((info, name) => pushSymbol(name, SymbolKind.EnumMember, info.range))
            classInfo.properties.forEach((info, name) => pushSymbol(name, SymbolKind.Property, info.range))
            classInfo.methodsBlocks.forEach((info) => pushSymbol(info.name, SymbolKind.Method, info.range))
            classInfo.enumerationsBlocks.forEach((info) => pushSymbol(info.name, SymbolKind.EnumMember, info.range))
            classInfo.propertiesBlocks.forEach((info) => pushSymbol(info.name, SymbolKind.Property, info.range))
        }
        codeData.functions.forEach((info, name) => pushSymbol(name, info.isClassMethod ? SymbolKind.Method : SymbolKind.Function, info.range))
        codeData.sections.forEach((sectionData) => {
            if (sectionData.isExplicit) {
                pushSymbol(sectionData.title, SymbolKind.Module, sectionData.range)
            }
        })

        /**
         * Handle a case when the indexer fails due to the user being in the middle of an edit.
         * Here the documentSymbol cache has some symbols but the codeData cache has none. So we
         * assume that the user will soon fix their code and just fall back to what we knew for now.
         */
        if (result.length === 0 && codeData.errorMessage !== undefined) {
            const cached = this._documentSymbolCache.get(uri) ?? result
            if (cached.length > 0) {
                return cached
            }
        }
        this._documentSymbolCache.set(uri, result)
        this._sendSectionRangesForHighlighting(codeData, uri)
        return result
    }

    private _sendSectionRangesForHighlighting (result: MatlabCodeData, uri: string): void {
        const sectionRanges = result.sections.map((sectionData) => sectionData.range);
        NotificationService.sendNotification(Notification.MatlabSections, { uri, sectionRanges })
    }
}

export default NavigationSupportProvider
