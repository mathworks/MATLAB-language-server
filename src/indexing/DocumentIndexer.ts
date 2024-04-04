// Copyright 2022 - 2024 The MathWorks, Inc.

import { TextDocument } from 'vscode-languageserver-textdocument'
import Indexer from './Indexer'
import FileInfoIndex from './FileInfoIndex'

const INDEXING_DELAY = 500 // Delay (in ms) after keystroke before attempting to re-index the document

/**
 * Handles indexing a currently open document to gather data about classes,
 * functions, and variables.
 */
class DocumentIndexer {
    private readonly pendingFilesToIndex = new Map<string, NodeJS.Timeout>()

    /**
     * Queues a document to be indexed. This handles debouncing so that
     * indexing is not performed on every keystroke.
     *
     * @param textDocument The document to be indexed
     */
    queueIndexingForDocument (textDocument: TextDocument): void {
        const uri = textDocument.uri
        this.clearTimerForDocumentUri(uri)
        this.pendingFilesToIndex.set(
            uri,
            setTimeout(() => {
                this.indexDocument(textDocument)
            }, INDEXING_DELAY) // Specify timeout for debouncing, to avoid re-indexing every keystroke while a user types
        )
    }

    /**
     * Indexes the document and caches the data.
     *
     * @param textDocument The document being indexed
     */
    indexDocument (textDocument: TextDocument): void {
        void Indexer.indexDocument(textDocument)
    }

    /**
     * Clears any active indexing timers for the provided document URI.
     *
     * @param uri The document URI
     */
    private clearTimerForDocumentUri (uri: string): void {
        const timerId = this.pendingFilesToIndex.get(uri)
        if (timerId != null) {
            clearTimeout(timerId)
            this.pendingFilesToIndex.delete(uri)
        }
    }

    /**
     * Ensure that @param textDocument is fully indexed and up to date by flushing any pending indexing tasks
     * and then forcing an index. This is intended to service requests like documentSymbols where returning
     * stale info could be confusing.
     *
     * @param textDocument The document to index
     */
    async ensureDocumentIndexIsUpdated (textDocument: TextDocument): Promise<void> {
        const uri = textDocument.uri
        if (this.pendingFilesToIndex.has(uri)) {
            this.clearTimerForDocumentUri(uri)
            await Indexer.indexDocument(textDocument)
        }
        if (!FileInfoIndex.codeDataCache.has(uri)) {
            await Indexer.indexDocument(textDocument)
        }
    }
}

export default new DocumentIndexer()
