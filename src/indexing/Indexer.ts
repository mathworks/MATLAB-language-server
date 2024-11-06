// Copyright 2022 - 2024 The MathWorks, Inc.

import { TextDocument } from 'vscode-languageserver-textdocument'
import { URI } from 'vscode-uri'
import { MatlabConnection } from '../lifecycle/MatlabCommunicationManager'
import MatlabLifecycleManager from '../lifecycle/MatlabLifecycleManager'
import FileInfoIndex, { MatlabCodeData, RawCodeData } from './FileInfoIndex'
import * as fs from 'fs/promises'
import PathResolver from '../providers/navigation/PathResolver'
import ConfigurationManager from '../lifecycle/ConfigurationManager'

interface WorkspaceFileIndexedResponse {
    isDone: boolean
    filePath: string
    codeData: RawCodeData
}

export default class Indexer {
    private readonly INDEX_DOCUMENT_REQUEST_CHANNEL = '/matlabls/indexDocument/request'
    private readonly INDEX_DOCUMENT_RESPONSE_CHANNEL = '/matlabls/indexDocument/response'

    private readonly INDEX_FOLDERS_REQUEST_CHANNEL = '/matlabls/indexFolders/request'
    private readonly INDEX_FOLDERS_RESPONSE_CHANNEL = '/matlabls/indexFolders/response'

    constructor (private matlabLifecycleManager: MatlabLifecycleManager, private pathResolver: PathResolver) {}

    /**
     * Indexes the given TextDocument and caches the data.
     *
     * @param textDocument The document being indexed
     */
    async indexDocument (textDocument: TextDocument): Promise<void> {
        const matlabConnection = await this.matlabLifecycleManager.getMatlabConnection()

        if (matlabConnection == null) {
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
    async indexFolders (folders: string[]): Promise<void> {
        const matlabConnection = await this.matlabLifecycleManager.getMatlabConnection()

        if (matlabConnection == null) {
            return
        }

        const channelId = matlabConnection.getChannelId()
        const channel = `${this.INDEX_FOLDERS_RESPONSE_CHANNEL}/${channelId}`
        const responseSub = matlabConnection.subscribe(channel, message => {
            const fileResults = message as WorkspaceFileIndexedResponse

            if (fileResults.isDone) {
                // No more files being indexed - safe to unsubscribe
                matlabConnection.unsubscribe(responseSub)
            }

            // Convert file path to URI, which is used as an index when storing the code data
            const fileUri = URI.file(fileResults.filePath).toString()
            FileInfoIndex.parseAndStoreCodeData(fileUri, fileResults.codeData)
        })

        const analysisLimit = (await ConfigurationManager.getConfiguration()).maxFileSizeForAnalysis

        matlabConnection.publish(this.INDEX_FOLDERS_REQUEST_CHANNEL, {
            folders,
            channelId,
            analysisLimit
        })
    }

    /**
     * Indexes the file for the given URI and caches the data.
     *
     * @param uri The URI for the file being indexed
     */
    async indexFile (uri: string): Promise<void> {
        const matlabConnection = await this.matlabLifecycleManager.getMatlabConnection()

        if (matlabConnection == null) {
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

        return await new Promise(async resolve => {
            const channelId = matlabConnection.getChannelId()
            const channel = `${this.INDEX_DOCUMENT_RESPONSE_CHANNEL}/${channelId}`
            const responseSub = matlabConnection.subscribe(channel, message => {
                matlabConnection.unsubscribe(responseSub)

                resolve(message as RawCodeData)
            })

            const analysisLimit = (await ConfigurationManager.getConfiguration()).maxFileSizeForAnalysis

            matlabConnection.publish(this.INDEX_DOCUMENT_REQUEST_CHANNEL, {
                code,
                filePath,
                channelId,
                analysisLimit
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

        const resolvedBaseClasses = await this.pathResolver.resolvePaths(baseClasses, uri, matlabConnection)

        resolvedBaseClasses.forEach(resolvedBaseClass => {
            const uri = resolvedBaseClass.uri
            if (uri !== '') {
                void this.indexFile(uri)
            }
        })
    }
}
