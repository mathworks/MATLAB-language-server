// Copyright 2022 - 2023 The MathWorks, Inc.

import { TextDocument } from 'vscode-languageserver-textdocument'
import { URI } from 'vscode-uri'
import { MatlabConnection } from '../lifecycle/MatlabCommunicationManager'
import MatlabLifecycleManager from '../lifecycle/MatlabLifecycleManager'
import FileInfoIndex, { MatlabCodeData, RawCodeData } from './FileInfoIndex'
import * as fs from 'fs/promises'
import PathResolver from '../providers/navigation/PathResolver'

interface WorkspaceFileIndexedResponse {
    isDone: boolean
    filePath: string
    codeData: RawCodeData
}

class Indexer {
    private readonly INDEX_DOCUMENT_REQUEST_CHANNEL = '/matlabls/indexDocument/request'
    private readonly INDEX_DOCUMENT_RESPONSE_CHANNEL = '/matlabls/indexDocument/response/' // Needs to be appended with requestId

    private readonly INDEX_FOLDERS_REQUEST_CHANNEL = '/matlabls/indexFolders/request'
    private readonly INDEX_FOLDERS_RESPONSE_CHANNEL = '/matlabls/indexFolders/response/' // Needs to be appended with requestId

    private requestCt = 1

    /**
     * Indexes the given TextDocument and caches the data.
     *
     * @param textDocument The document being indexed
     */
    async indexDocument (textDocument: TextDocument): Promise<void> {
        const matlabConnection = MatlabLifecycleManager.getMatlabConnection()

        if (matlabConnection == null || !MatlabLifecycleManager.isMatlabReady()) {
            return
        }

        const rawCodeData = await this.getCodeData(textDocument.getText(), textDocument.uri, matlabConnection)

        const parsedCodeData = FileInfoIndex.parseAndStoreCodeData(textDocument.uri, rawCodeData)

        void this.indexAdditionalClassData(parsedCodeData, matlabConnection, textDocument.uri)
    }

    /**
     * Indexes all M files within the given list of folders.
     *
     * @param folders A list of folder URIs to be indexed
     */
    indexFolders (folders: string[]): void {
        const matlabConnection = MatlabLifecycleManager.getMatlabConnection()

        if (matlabConnection == null || !MatlabLifecycleManager.isMatlabReady()) {
            return
        }

        const requestId = this.requestCt++
        const responseSub = matlabConnection.subscribe(`${this.INDEX_FOLDERS_RESPONSE_CHANNEL}${requestId}`, message => {
            const fileResults = message as WorkspaceFileIndexedResponse

            if (fileResults.isDone) {
                // No more files being indexed - safe to unsubscribe
                matlabConnection.unsubscribe(responseSub)
            }

            // Convert file path to URI, which is used as an index when storing the code data
            const fileUri = URI.file(fileResults.filePath).toString()
            FileInfoIndex.parseAndStoreCodeData(fileUri, fileResults.codeData)
        })

        matlabConnection.publish(this.INDEX_FOLDERS_REQUEST_CHANNEL, {
            folders,
            requestId
        })
    }

    /**
     * Indexes the file for the given URI and caches the data.
     *
     * @param uri The URI for the file being indexed
     */
    async indexFile (uri: string): Promise<void> {
        const matlabConnection = MatlabLifecycleManager.getMatlabConnection()

        if (matlabConnection == null || !MatlabLifecycleManager.isMatlabReady()) {
            return
        }

        const fileContentBuffer = await fs.readFile(URI.parse(uri).fsPath)
        const code = fileContentBuffer.toString()
        const rawCodeData = await this.getCodeData(code, uri, matlabConnection)

        FileInfoIndex.parseAndStoreCodeData(uri, rawCodeData)
    }

    /**
     * Retrieves data about classes, functions, and variables from the given document.
     *
     * @param code The code being parsed
     * @param uri The URI associated with the code
     * @param matlabConnection The connection to MATLAB®
     *
     * @returns The raw data extracted from the document
     */
    private async getCodeData (code: string, uri: string, matlabConnection: MatlabConnection): Promise<RawCodeData> {
        const filePath = URI.parse(uri).fsPath

        return await new Promise(resolve => {
            const requestId = this.requestCt++
            const responseSub = matlabConnection.subscribe(`${this.INDEX_DOCUMENT_RESPONSE_CHANNEL}${requestId}`, message => {
                matlabConnection.unsubscribe(responseSub)

                resolve(message as RawCodeData)
            })

            matlabConnection.publish(this.INDEX_DOCUMENT_REQUEST_CHANNEL, {
                code,
                filePath,
                requestId
            })
        })
    }

    /**
     * Indexes any supplemental files if the parsed code data represents a class.
     * This will index any other files in a @ directory, as well as any direct base classes.
     *
     * @param parsedCodeData The parsed code data
     * @param matlabConnection The connection to MATLAB
     * @param uri The document's URI
     */
    private async indexAdditionalClassData (parsedCodeData: MatlabCodeData, matlabConnection: MatlabConnection, uri: string): Promise<void> {
        if (parsedCodeData.classInfo == null) {
            return
        }

        // Queue indexing for other files in @ class directory
        const classDefFolder = parsedCodeData.classInfo.classDefFolder
        if (classDefFolder !== '') {
            this.indexFolders([classDefFolder])
        }

        // Find and queue indexing for parent classes
        const baseClasses = parsedCodeData.classInfo.baseClasses

        const resolvedBaseClasses = await PathResolver.resolvePaths(baseClasses, uri, matlabConnection)

        resolvedBaseClasses.forEach(resolvedBaseClass => {
            const uri = resolvedBaseClass.uri
            if (uri !== '') {
                void this.indexFile(uri)
            }
        })
    }
}

export default new Indexer()
