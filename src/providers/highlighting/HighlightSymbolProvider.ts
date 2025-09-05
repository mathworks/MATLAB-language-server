// Copyright 2025 The MathWorks, Inc.

import { DocumentHighlight, DocumentHighlightKind, DocumentHighlightParams, Location, TextDocuments } from 'vscode-languageserver'
import MatlabLifecycleManager from '../../lifecycle/MatlabLifecycleManager'
import SymbolSearchService, { reportTelemetry, RequestType } from '../../indexing/SymbolSearchService'
import { getExpressionAtPosition } from '../../utils/ExpressionUtils'
import { TextDocument } from 'vscode-languageserver-textdocument'
import DocumentIndexer from '../../indexing/DocumentIndexer'
import PathResolver from '../navigation/PathResolver'
import Indexer from '../../indexing/Indexer'
import { rangeContains } from '../../utils/RangeUtils'

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
        protected readonly pathResolver: PathResolver,
        protected readonly indexer: Indexer
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

        // Determine the expression the user's cursor is on
        const expression = getExpressionAtPosition(textDocument, params.position)
        if (expression == null) {
            // There may still be an expression at the cursor position in this case,
            // but not one for which finding references is supported (e.g., it may
            // be a numeric literal)
            return []
        }

        await this.documentIndexer.ensureDocumentIndexIsUpdated(textDocument)

        // Find all references to the selected expression in the current file;
        // these will be highlighted
        const references: Location[] = SymbolSearchService
            .findReferences(
                currentDocumentUri, params.position, expression, documentManager, RequestType.DocumentHighlight
            )
            .filter(ref => ref.uri === currentDocumentUri)

        /* This helps to determine which references are "write references" - e.g.,
         * variable assignments, function definitions - and which are "read
         * references" - e.g., variable accesses, function calls.
         *
         * If the selected identifier refers to a variable, we find the locations
         * where it is used in an assignment statement (in the current file). If
         * it refers to a function, we find the location of the function definition
         * (if it is in the current file).
         */
        const definitions: Location[] = await SymbolSearchService
            .findDefinitions(
                currentDocumentUri, params.position, expression, this.pathResolver, this.indexer, RequestType.DocumentHighlight
            )

        return references.map(ref => {
            /* Since for function definitions, the location of the entire definition
             * header is reported (not just the name of the function in the definition),
             * we determine that a reference to a variable/function/etc. is a write
             * reference if it is contained within the location of a definition of that
             * variable/function/etc.
             */
            const isWriteReference = definitions.some(def => rangeContains(def.range, ref.range))
            return DocumentHighlight.create(
                ref.range,
                isWriteReference ? DocumentHighlightKind.Write : DocumentHighlightKind.Read
            )
        })
    }
}

export default HighlightSymbolProvider
