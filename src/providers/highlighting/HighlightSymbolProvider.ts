// Copyright 2025 The MathWorks, Inc.

import { DocumentHighlight, DocumentHighlightKind, DocumentHighlightParams, Range, TextDocuments } from 'vscode-languageserver'
import MatlabLifecycleManager from '../../lifecycle/MatlabLifecycleManager'
import { reportTelemetry, RequestType } from '../../indexing/SymbolSearchService'
import { TextDocument } from 'vscode-languageserver-textdocument'
import DocumentIndexer from '../../indexing/DocumentIndexer'
import Indexer from '../../indexing/Indexer'
import { areRangesEqual } from '../../utils/RangeUtils'
import * as SymbolSearchService from '../../indexing/SymbolSearchService'
import FileInfoIndex from '../../indexing/FileInfoIndex'

/**
 * Handles requests for document highlights, given a position in a file.
 * 
 * Will report which ranges within a document should be highlighted, and as which
 * type of reference, given the user's cursor position in that document.
 */
class HighlightSymbolProvider {
    constructor (
        protected readonly matlabLifecycleManager: MatlabLifecycleManager,
        protected readonly documentIndexer: DocumentIndexer,
        protected readonly indexer: Indexer,
        protected readonly fileInfoIndex: FileInfoIndex
    ) {}

    /**
     * Handles a request for document highlights.
     * 
     * Document highlights reflect which ranges within a document should be
     * highlighted (to mark references to a symbol), and as which type of
     * reference each range should be highlighted.
     * 
     * @param params Parameters for the onDocumentHighlight request (including
     *     the user's current cursor position)
     * @param documentManager The text document manager
     * @returns The computed array of document highlights, or null if highlights
     *     could not be computed and the client's default highlighting behavior
     *     should be used instead
     */
    async handleDocumentHighlightRequest (params: DocumentHighlightParams,
        documentManager: TextDocuments<TextDocument>): Promise<DocumentHighlight[] | null> {

        // Since this request handler is activated by clicking on any text in a
        // MATLAB file, we should not connect to MATLAB just because it was called
        const matlabConnection = await this.matlabLifecycleManager.getMatlabConnection(false)
        if (matlabConnection == null) {
            // If MATLAB is not connected, fall back to the client's default
            // highlighting behavior
            return null
        }

        const currentDocumentUri = params.textDocument.uri

        const textDocument = documentManager.get(currentDocumentUri)
        if (textDocument == null) {
            reportTelemetry(RequestType.DocumentHighlight, 'No document')
            return []
        }

        await this.documentIndexer.ensureDocumentIndexIsUpdated(textDocument)

        /* All references to the selected identifier component that are in the current
         * file will be highlighted. If a reference coincides with a definition - e.g.,
         * a variable assignment or function declaration - we highlight it as a write
         * reference; other references are highlighted as read references.
         */

        const { references, definitions } = SymbolSearchService.findReferencesAndDefinitions(
            currentDocumentUri, params.position, this.fileInfoIndex, documentManager, RequestType.DocumentHighlight
        )

        const currentFileRefRanges: Range[] = references.filter(ref => ref.uri === currentDocumentUri).map(ref => ref.range)
        const currentFileDefRanges: Range[] = definitions.filter(def => def.uri === currentDocumentUri).map(def => def.range)

        return currentFileRefRanges.map(refRange => {
            const isWriteReference = currentFileDefRanges.some(defRange => areRangesEqual(defRange, refRange))
            return DocumentHighlight.create(
                refRange,
                isWriteReference ? DocumentHighlightKind.Write : DocumentHighlightKind.Read
            )
        })
    }
}

export default HighlightSymbolProvider
