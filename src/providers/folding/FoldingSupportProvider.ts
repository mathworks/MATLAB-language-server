// Copyright 2024-2025 The MathWorks, Inc.

import { FoldingRangeParams, TextDocuments, FoldingRange } from 'vscode-languageserver'
import { TextDocument } from 'vscode-languageserver-textdocument'
import MatlabLifecycleManager from '../../lifecycle/MatlabLifecycleManager'
import MVM from '../../mvm/impl/MVM'
import Logger from '../../logging/Logger'
import parse from '../../mvm/MdaParser'

class FoldingSupportProvider {
    constructor (private readonly matlabLifecycleManager: MatlabLifecycleManager, private readonly mvm: MVM) {}

    async handleFoldingRangeRequest (params: FoldingRangeParams, documentManager: TextDocuments<TextDocument>): Promise<FoldingRange[] | null> {
        const docToFold = documentManager.get(params.textDocument.uri)
        if (docToFold == null) {
            return null
        }

        const isConnected = this.mvm.isReady()
        const matlabRelease = this.matlabLifecycleManager.getMatlabRelease()

        // check for connection and release
        if (!isConnected || (matlabRelease == null) || (matlabRelease < 'R2024b')) {
            return null
        }

        const code = docToFold.getText()

        const frArray = await this.getFoldingRangesFromMatlab(code)

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
    private async getFoldingRangesFromMatlab (code: string): Promise<number[]> {
        try {
            const response = await this.mvm.feval(
                'matlabls.handlers.folding.getFoldingRanges',
                1,
                [code]
            )

            if ('error' in response) {
                // Handle MVMError
                Logger.error('Error received while retrieving folding ranges:')
                Logger.error(response.error.msg)
                return []
            }

            return parse(response.result[0]) as number[]
        } catch (err) {
            Logger.error('Error caught while retrieving folding ranges:')
            Logger.error(err as string)
            return []
        }
    }

    /**
     * Processes folding range data from MATLAB.
     *
     * @param frArray An array of line numbers from MATLAB
     * @returns An array of FoldingRanges
     */
    private processFoldingRanges (frArray: number[]): FoldingRange[] {
        const fRangeArray: FoldingRange[] = []

        for (let i = 0; i < frArray.length; i = i + 2) {
            const fRange = FoldingRange.create(frArray[i] - 1, frArray[i + 1] - 1)
            fRangeArray.push(fRange)
        }

        return fRangeArray
    }
}

export default FoldingSupportProvider
