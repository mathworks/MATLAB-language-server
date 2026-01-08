// Copyright 2025 The MathWorks, Inc.

import { WorkspaceEdit, PrepareRenameParams, RenameParams, Range, TextDocuments, TextEdit, Location } from 'vscode-languageserver'
import { TextDocument } from 'vscode-languageserver-textdocument'
import LifecycleNotificationHelper from '../../lifecycle/LifecycleNotificationHelper'
import FileInfoIndex, { NamedRange } from '../../indexing/FileInfoIndex'
import { ActionErrorConditions } from '../../logging/TelemetryUtils'
import { RequestType, findSelectedIdentifierComponent, reportTelemetry } from '../../indexing/SymbolSearchService'
import MatlabLifecycleManager from '../../lifecycle/MatlabLifecycleManager'
import DocumentIndexer from '../../indexing/DocumentIndexer'
import * as SymbolSearchService from '../../indexing/SymbolSearchService'

class RenameSymbolProvider {
    constructor (
        protected matlabLifecycleManager: MatlabLifecycleManager,
        protected documentIndexer: DocumentIndexer,
        protected fileInfoIndex: FileInfoIndex
    ) {}

    /**
     * Determines if a symbol that can be renamed exists at the specified position.
     *
     * @param params Parameters for the prepare rename request
     * @param documentManager The text document manager
     * @returns A range and placeholder text
     */
    async prepareRename (params: PrepareRenameParams, documentManager: TextDocuments<TextDocument>): Promise<{ range: Range, placeholder: string } | null> {
        const matlabConnection = await this.matlabLifecycleManager.getMatlabConnection(true)
        if (matlabConnection == null) {
            LifecycleNotificationHelper.notifyMatlabRequirement()
            reportTelemetry(RequestType.RenameSymbol, ActionErrorConditions.MatlabUnavailable)
            return null
        }

        const uri = params.textDocument.uri

        const textDocument = documentManager.get(uri)
        if (textDocument == null) {
            reportTelemetry(RequestType.RenameSymbol, 'No document')
            return null
        }

        await this.documentIndexer.ensureDocumentIndexIsUpdated(textDocument)

        const selectedIdentifierComponent: NamedRange | null = findSelectedIdentifierComponent(
            uri, params.position, this.fileInfoIndex, documentManager, RequestType.RenameSymbol
        )
        if (selectedIdentifierComponent == null) {
            return null
        }

        return { range: selectedIdentifierComponent.range, placeholder: selectedIdentifierComponent.name }
    }

    /**
     * Handles requests for renaming.
     *
     * @param params Parameters for the rename request
     * @param documentManager The text document manager
     * @returns A WorkspaceEdit object
     */
    async handleRenameRequest (params: RenameParams, documentManager: TextDocuments<TextDocument>): Promise<WorkspaceEdit | null> {
        const matlabConnection = await this.matlabLifecycleManager.getMatlabConnection(true)
        if (matlabConnection == null) {
            LifecycleNotificationHelper.notifyMatlabRequirement()
            reportTelemetry(RequestType.RenameSymbol, ActionErrorConditions.MatlabUnavailable)
            return null
        }

        const uri = params.textDocument.uri

        const textDocument = documentManager.get(uri)
        if (textDocument == null) {
            reportTelemetry(RequestType.RenameSymbol, 'No document')
            return null
        }

        await this.documentIndexer.ensureDocumentIndexIsUpdated(textDocument)

        const refs: Location[] = SymbolSearchService.findReferences(
            uri, params.position, this.fileInfoIndex, documentManager, RequestType.RenameSymbol
        )

        // uri -> edits
        const changes = new Map<string, TextEdit[]>()

        refs.forEach(location => {
            const newEdit = TextEdit.replace(location.range, params.newName)

            const changesForLocationUri: TextEdit[] | undefined = changes.get(location.uri)
            if (changesForLocationUri) {
                changesForLocationUri.push(newEdit)
            } else {
                changes.set(location.uri, [newEdit])
            }
        })

        return { changes: Object.fromEntries(changes) }
    }
}

export default RenameSymbolProvider
