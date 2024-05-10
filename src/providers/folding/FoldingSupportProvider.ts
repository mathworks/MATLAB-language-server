// Copyright 2024 The MathWorks, Inc.

import { FoldingRangeParams, TextDocuments, FoldingRange} from 'vscode-languageserver'
import { TextDocument } from 'vscode-languageserver-textdocument'
import { URI } from 'vscode-uri'
import MatlabLifecycleManager from '../../lifecycle/MatlabLifecycleManager'
import { MatlabConnection } from '../../lifecycle/MatlabCommunicationManager'


class FoldingSupportProvider {
    private readonly REQUEST_CHANNEL = '/matlabls/foldDocument/request'
    private readonly RESPONSE_CHANNEL = '/matlabls/foldDocument/response'

    async handleFoldingRangeRequest (params: FoldingRangeParams, documentManager: TextDocuments<TextDocument>): Promise<FoldingRange[] | null> {
        const docToFold = documentManager.get(params.textDocument.uri)
        if (docToFold == null) {
            return null
        }

        const matlabConnection = await MatlabLifecycleManager.getMatlabConnection()
        const isMatlabAvailable = (matlabConnection != null)
        const matlabRelease = MatlabLifecycleManager.getMatlabRelease()

        // check for connection and release
        if (!isMatlabAvailable || (matlabRelease == null) || (matlabRelease < 'R2024b')) {
            return null
        }

        const fileName = URI.parse(docToFold.uri).fsPath
        const code = docToFold.getText()

        const frArray = await this.getFoldingRangesFromMatlab(code, fileName, matlabConnection)

        const foldingRanges = this.processFoldingRanges(frArray)

        return foldingRanges;
    }

    /**
     * Gets folding ranges from MATLAB.
     *
     * @param code The code in the file
     * @param fileName The file's name
     * @param matlabConnection The connection to MATLAB
     * @returns An array of line numbers
     */
    private async getFoldingRangesFromMatlab (code: string, fileName: string, matlabConnection: MatlabConnection): Promise<number[]> {
        return await new Promise<number[]>(resolve => {
            const channelId = matlabConnection.getChannelId()
            const channel = `${this.RESPONSE_CHANNEL}/${channelId}`
            const responseSub = matlabConnection.subscribe(channel, message => {
                matlabConnection.unsubscribe(responseSub)
                resolve(message as number[])
            })

            matlabConnection.publish(this.REQUEST_CHANNEL, {
                code,
                fileName,
                channelId
            })
        })
    }

    /**
     * Processes folding range data from MATLAB.
     *
     * @param frArray An array of line numbers from MATLAB
     * @returns An array of FoldingRanges
     */
    private processFoldingRanges (frArray: number[]): FoldingRange[] {
        let fRangeArray: FoldingRange[] = []

        for(let i = 0; i < frArray.length; i = i+2) {
            let fRange = FoldingRange.create(frArray[i] - 1, frArray[i+1] - 1)
            fRangeArray.push(fRange)
        }

        return fRangeArray
    }
}

export default new FoldingSupportProvider()
