// Copyright 2022 - 2025 The MathWorks, Inc.

import { TextDocument } from 'vscode-languageserver-textdocument'
import { URI } from 'vscode-uri'
import MatlabLifecycleManager from '../lifecycle/MatlabLifecycleManager'
import FileInfoIndex, { MatlabCodeData, RawCodeData } from './FileInfoIndex'
import * as fs from 'fs/promises'
import PathResolver from '../providers/navigation/PathResolver'
import ConfigurationManager from '../lifecycle/ConfigurationManager'
import MVM from '../mvm/impl/MVM'
import Logger from '../logging/Logger'
import parse from '../mvm/MdaParser'
import * as FileNameUtils from '../utils/FileNameUtils'

interface WorkspaceFileIndexedResponse {
    isDone: boolean
    filePath: string
    codeData: RawCodeData
}

export default class Indexer {
    private readonly INDEX_FOLDERS_RESPONSE_CHANNEL = '/matlabls/indexFolders/response'

    constructor (
        private readonly matlabLifecycleManager: MatlabLifecycleManager,
        private readonly mvm: MVM,
        private readonly pathResolver: PathResolver
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

        const rawCodeData = await this.getCodeData(textDocument.getText(), textDocument.uri)

        if (rawCodeData === null) {
            return
        }

        const parsedCodeData = FileInfoIndex.parseAndStoreCodeData(textDocument.uri, rawCodeData)

        void this.indexAdditionalClassData(parsedCodeData, textDocument.uri)
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

            // Convert file path to URI, which is used as an index when storing the code data
            const fileUri = URI.file(fileResults.filePath).toString()
            FileInfoIndex.parseAndStoreCodeData(fileUri, fileResults.codeData)
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
        const rawCodeData = await this.getCodeData(code, uri)

        if (rawCodeData === null) {
            return
        }

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
    private async getCodeData (code: string, uri: string): Promise<RawCodeData | null> {
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

            return parse(response.result[0]) as RawCodeData
        } catch (err) {
            Logger.error('Error caught while parsing file:')
            Logger.error(err as string)
            return null
        }
    }

    /**
     * Indexes any supplemental files if the parsed code data represents a class.
     * This will index any other files in a @ directory, as well as any direct base classes.
     *
     * @param parsedCodeData The parsed code data
     * @param matlabConnection The connection to MATLAB
     * @param uri The document's URI
     */
    private async indexAdditionalClassData (parsedCodeData: MatlabCodeData, uri: string): Promise<void> {
        if (parsedCodeData.classInfo == null) {
            return
        }

        // Queue indexing for other files in @ class directory
        const classDefFolder = parsedCodeData.classInfo.classDefFolder
        if (classDefFolder !== '') {
            void this.indexFolders([classDefFolder])
        }

        // Find and queue indexing for parent classes
        const baseClasses = parsedCodeData.classInfo.baseClasses

        baseClasses.forEach(async baseClass => {
            const resolvedUri = await this.pathResolver.resolvePath(baseClass, uri)
            if (resolvedUri !== '' && resolvedUri !== null) {
                void this.indexFile(resolvedUri)
            }
        })
    }
}
