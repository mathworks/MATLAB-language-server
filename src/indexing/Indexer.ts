// Copyright 2022 - 2025 The MathWorks, Inc.

import { TextDocument } from 'vscode-languageserver-textdocument'
import { URI } from 'vscode-uri'
import MatlabLifecycleManager from '../lifecycle/MatlabLifecycleManager'
import FileInfoIndex, { CodeInfo, MatlabClassInfo } from './FileInfoIndex'
import * as fs from 'fs/promises'
import ConfigurationManager from '../lifecycle/ConfigurationManager'
import MVM from '../mvm/impl/MVM'
import Logger from '../logging/Logger'
import parse from '../mvm/MdaParser'
import * as FileNameUtils from '../utils/FileNameUtils'

interface WorkspaceFileIndexedResponse {
    isDone: boolean
    filePath: string
    codeData: CodeInfo
}

export default class Indexer {
    private readonly INDEX_FOLDERS_RESPONSE_CHANNEL = '/matlabls/indexFolders/response'

    constructor (
        private readonly matlabLifecycleManager: MatlabLifecycleManager,
        private readonly mvm: MVM,
        private readonly fileInfoIndex: FileInfoIndex
    ) {}

    /**
     * Indexes the given TextDocument and caches the data.
     *
     * @param textDocument The document being indexed
     */
    async indexDocument (textDocument: TextDocument): Promise<void> {
        if (!this.mvm.isReady()) {
            // MVM not yet ready
            return
        }

        const codeInfo = await this.getCodeInfo(textDocument.getText(), textDocument.uri)

        if (codeInfo === null) {
            return
        }

        const existingAssociatedClassInfo: MatlabClassInfo | undefined =
            this.fileInfoIndex.codeInfoCache.get(textDocument.uri)?.associatedClassInfo

        // if this file has previously contributed its info
        // to parsed class info
        if (existingAssociatedClassInfo) {
            existingAssociatedClassInfo.clear()

            const parsedCodeInfo = this.fileInfoIndex.parseAndStoreCodeInfo(textDocument.uri, codeInfo)

            // Queue indexing for other files in @ class directory
            const classDefFolder = parsedCodeInfo.classDefFolder
            if (classDefFolder) {
                this.indexFolders([classDefFolder])
            }
        } else {
            this.fileInfoIndex.parseAndStoreCodeInfo(textDocument.uri, codeInfo)
        }
    }

    /**
     * Indexes all M files within the given list of folders.
     *
     * @param folders A list of folder URIs to be indexed
     */
    async indexFolders (folders: string[]): Promise<void> {
        const matlabConnection = await this.matlabLifecycleManager.getMatlabConnection()

        if (matlabConnection == null || !this.mvm.isReady()) {
            return
        }

        const channelId = matlabConnection.getChannelId()
        const responseChannel = `${this.INDEX_FOLDERS_RESPONSE_CHANNEL}/${channelId}`

        const analysisLimit = (await ConfigurationManager.getConfiguration()).maxFileSizeForAnalysis

        const responseSub = matlabConnection.subscribe(responseChannel, message => {
            const fileResults = message as WorkspaceFileIndexedResponse

            if (fileResults.isDone) {
                // No more files being indexed - safe to unsubscribe
                matlabConnection.unsubscribe(responseSub)
            }

            if (fileResults.codeData.errorInfo === undefined) {
                // Convert file path to URI, which is used as an index when storing the code data
                const fileUri = URI.file(fileResults.filePath).toString()
                this.fileInfoIndex.parseAndStoreCodeInfo(fileUri, fileResults.codeData)
            }
        })

        try {
            const mdaFolders = {
                mwtype: 'string',
                mwsize: [1, folders.length],
                mwdata: folders
            }

            const response = await this.mvm.feval(
                'matlabls.handlers.indexing.parseInfoFromFolder',
                0,
                [mdaFolders, analysisLimit, responseChannel]
            )

            if ('error' in response) {
                Logger.error('Error received while indexing folders:')
                Logger.error(response.error.msg)
                Logger.warn('Not all files may have been indexed successfully.')
                matlabConnection.unsubscribe(responseSub)
            }
        } catch (err) {
            Logger.error('Error caught while indexing folders:')
            Logger.error(err as string)
            Logger.warn('Not all files may have been indexed successfully.')
        }
    }

    /**
     * Indexes the file for the given URI and caches the data.
     *
     * @param uri The URI for the file being indexed
     */
    async indexFile (uri: string): Promise<void> {
        if (!this.mvm.isReady()) {
            // MVM not yet ready
            return
        }

        const filePath = FileNameUtils.getFilePathFromUri(uri)
        const fileContentBuffer = await fs.readFile(filePath)
        const code = fileContentBuffer.toString()
        const codeInfo = await this.getCodeInfo(code, uri)

        if (codeInfo === null) {
            return
        }

        this.fileInfoIndex.parseAndStoreCodeInfo(uri, codeInfo)
    }

    /**
     * Retrieves data about classes, functions, and variables from the given document.
     *
     * @param code The code being parsed
     * @param uri The URI associated with the code
     *
     * @returns The raw data extracted from the document
     */
    private async getCodeInfo (code: string, uri: string): Promise<CodeInfo | null> {
        const filePath = FileNameUtils.getFilePathFromUri(uri)
        const analysisLimit = (await ConfigurationManager.getConfiguration()).maxFileSizeForAnalysis

        try {
            const response = await this.mvm.feval(
                'matlabls.handlers.indexing.parseInfoFromDocument',
                1,
                [code, filePath, analysisLimit]
            )

            if ('error' in response) {
                Logger.error('Error received while parsing file:')
                Logger.error(response.error.msg)
                return null
            }

            const codeInfo = parse(response.result[0]) as CodeInfo

            if (codeInfo.errorInfo === undefined) {
                return codeInfo
            } else {
                return null
            }
        } catch (err) {
            Logger.error('Error caught while parsing file:')
            Logger.error(err as string)
            return null
        }
    }
}
