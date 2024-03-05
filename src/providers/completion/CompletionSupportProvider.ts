// Copyright 2022 - 2024 The MathWorks, Inc.

import { CompletionItem, CompletionItemKind, CompletionList, CompletionParams, ParameterInformation, Position, SignatureHelp, SignatureHelpParams, SignatureInformation, TextDocuments } from 'vscode-languageserver'
import { TextDocument } from 'vscode-languageserver-textdocument'
import { URI } from 'vscode-uri'
import MatlabLifecycleManager from '../../lifecycle/MatlabLifecycleManager'

interface MCompletionData {
    widgetData?: MWidgetData
    widgetType?: string
    signatures?: MSignatureData | MSignatureData[] // If there is only one signature, it is not given as an array
}

interface MWidgetData {
    choices?: MCompletionChoice | MCompletionChoice[] // If there is only one choice, it is not given as an array
    truncated?: boolean
}

interface MCompletionChoice {
    completion: string
    matchType: string
    purpose: string
    displayString?: string
}

interface MSignatureData {
    functionName: string
    inputArguments?: MArgumentData | MArgumentData[] // If there is only one argument, it is not given as an array
    outputArguments?: MArgumentData | MArgumentData[] // If there is only one argument, it is not given as an array
}

interface MArgumentData {
    name: string
    widgetType: string
    widgetData?: MWidgetData
    status?: string
    purpose?: string
    valueSummary?: string
}

// Maps the completion type, as returned by MATLAB®, to the corresponding CompletionItemKind
const MatlabCompletionToKind: { [index: string]: CompletionItemKind } = {
    literal: CompletionItemKind.Text,
    unknown: CompletionItemKind.Function,
    pathItem: CompletionItemKind.File,
    mFile: CompletionItemKind.Function,
    pFile: CompletionItemKind.Function,
    mlxFile: CompletionItemKind.Function,
    mlappFile: CompletionItemKind.Function,
    mex: CompletionItemKind.Function,
    mdlFile: CompletionItemKind.Function,
    slxFile: CompletionItemKind.Function,
    slxpFile: CompletionItemKind.Function,
    sscFile: CompletionItemKind.Function,
    sscpFile: CompletionItemKind.Function,
    sfxFile: CompletionItemKind.Class,
    folder: CompletionItemKind.Folder,
    logical: CompletionItemKind.Value,
    function: CompletionItemKind.Function,
    filename: CompletionItemKind.File,
    localFunction: CompletionItemKind.Function,
    fieldname: CompletionItemKind.Field,
    username: CompletionItemKind.Text,
    variable: CompletionItemKind.Variable,
    feature: CompletionItemKind.Text,
    cellString: CompletionItemKind.Value,
    class: CompletionItemKind.Class,
    package: CompletionItemKind.Module,
    property: CompletionItemKind.Property,
    method: CompletionItemKind.Method,
    enumeration: CompletionItemKind.EnumMember,
    messageId: CompletionItemKind.Text,
    keyword: CompletionItemKind.Keyword,
    attribute: CompletionItemKind.Keyword
}

/**
 * Handles requests for completion-related features.
 * Currently, this handles auto-completion as well as function signature help.
 */
class CompletionProvider {
    private readonly REQUEST_CHANNEL = '/matlabls/completions/request'
    private readonly RESPONSE_CHANNEL = '/matlabls/completions/response'

    /**
     * Handles a request for auto-completion choices.
     *
     * @param params Parameters from the onCompletion request
     * @param documentManager The text document manager
     * @returns An array of possible completions
     */
    async handleCompletionRequest (params: CompletionParams, documentManager: TextDocuments<TextDocument>): Promise<CompletionList> {
        const doc = documentManager.get(params.textDocument.uri)

        if (doc == null) {
            return CompletionList.create()
        }

        const completionData = await this.retrieveCompletionData(doc, params.position)

        return this.parseCompletionItems(completionData)
    }

    /**
     * Handles a request for function signature help.
     *
     * @param params Parameters from the onSignatureHelp request
     * @param documentManager The text document manager
     * @returns The signature help, or null if no signature help is available
     */
    async handleSignatureHelpRequest (params: SignatureHelpParams, documentManager: TextDocuments<TextDocument>): Promise<SignatureHelp | null> {
        const doc = documentManager.get(params.textDocument.uri)

        if (doc == null) {
            return null
        }

        const completionData = await this.retrieveCompletionData(doc, params.position)

        return this.parseSignatureHelp(completionData)
    }

    /**
     * Retrieves raw completion data from MATLAB.
     *
     * @param doc The text document
     * @param position The cursor position in the document
     * @returns The raw completion data
     */
    private async retrieveCompletionData (doc: TextDocument, position: Position): Promise<MCompletionData> {
        const docUri = doc.uri

        const code = doc.getText()
        const fileName = URI.parse(docUri).fsPath
        const cursorPosition = doc.offsetAt(position)

        const matlabConnection = MatlabLifecycleManager.getMatlabConnection()

        if (matlabConnection == null || !MatlabLifecycleManager.isMatlabReady()) {
            return {}
        }

        return await new Promise(resolve => {
            const channelId = matlabConnection.getChannelId()
            const channel = `${this.RESPONSE_CHANNEL}/${channelId}`
            const responseSub = matlabConnection.subscribe(channel, message => {
                matlabConnection.unsubscribe(responseSub)

                resolve(message as MCompletionData)
            })

            matlabConnection.publish(this.REQUEST_CHANNEL, {
                code,
                fileName,
                cursorPosition,
                channelId
            })
        })
    }

    /**
     * Parses the raw completion data to extract possible auto-completions.
     *
     * @param completionData The raw completion data
     * @returns A list of completion items
     */
    private parseCompletionItems (completionData: MCompletionData): CompletionList {
        const completionItems: CompletionItem[] = []

        const completionsMap = new Map<string, { kind: CompletionItemKind, doc: string }>()

        // Gather completions from top-level object. This should find function completions.
        this.gatherCompletions(completionData, completionsMap)

        // Gather completions from each signature. This should find function argument completions.
        let signatures = completionData.signatures
        if (signatures != null) {
            signatures = Array.isArray(signatures) ? signatures : [signatures]

            signatures.forEach(signature => {
                let inputArguments = signature.inputArguments
                if (inputArguments == null) {
                    return
                }

                inputArguments = Array.isArray(inputArguments) ? inputArguments : [inputArguments]

                inputArguments.forEach(inputArgument => {
                    this.gatherCompletions(inputArgument, completionsMap)
                })
            })
        }

        let index = 0
        completionsMap.forEach((completionData, completionName) => {
            // Preserve the sorting from MATLAB
            const sortText = String(index).padStart(10, '0')

            const completionItem = CompletionItem.create(completionName)
            completionItem.kind = completionData.kind
            completionItem.detail = completionData.doc
            completionItem.data = index++
            completionItem.sortText = sortText
            completionItems.push(completionItem)
        })

        return CompletionList.create(completionItems, completionData.widgetData?.truncated ?? false)
    }

    /**
     * Parses raw completion and argument data and stores info about possible completions in the provided map.
     *
     * @param completionDataObj Raw completion or argument data
     * @param completionMap A map in which to store info about possible completions
     */
    private gatherCompletions (completionDataObj: MCompletionData | MArgumentData, completionMap: Map<string, { kind: CompletionItemKind, doc: string }>): void {
        let choices = completionDataObj.widgetData?.choices
        if (choices == null) {
            return
        }

        choices = Array.isArray(choices) ? choices : [choices]

        choices.forEach(choice => {
            let completion: string = choice.completion
            let isPath = false

            switch (choice.matchType) {
                case 'folder':
                case 'filename':
                    // For files and folders, the completion is the full path whereas the displayString is the path to be added
                    completion = choice.displayString ?? ''
                    isPath = true
                    break
                case 'messageId':
                    // Remove quotes from completion
                    completion = (choice.displayString ?? '').replace(/['"]/g, '')
                    break
            }

            const dotIdx = choice.completion.lastIndexOf('.')
            if (dotIdx > 0 && !isPath) {
                completion = completion.slice(dotIdx + 1)
            }

            completionMap.set(completion, {
                kind: MatlabCompletionToKind[choice.matchType] ?? CompletionItemKind.Function,
                doc: choice.purpose
            })
        })
    }

    /**
     * Parses the raw completion data to extract function signature help.
     *
     * @param completionData The raw completion data
     * @returns The signature help, or null if no signature help is available
     */
    private parseSignatureHelp (completionData: MCompletionData): SignatureHelp | null {
        let signatureData = completionData.signatures

        if (signatureData == null) {
            return null
        }

        signatureData = Array.isArray(signatureData) ? signatureData : [signatureData]

        const signatureHelp: SignatureHelp = {
            activeParameter: 0,
            activeSignature: 0,
            signatures: []
        }

        // Parse each signature
        signatureData.forEach(sigData => {
            const params: ParameterInformation[] = []

            // Handle function inputs
            const argNames: string[] = []
            let inputArguments = sigData.inputArguments

            if (inputArguments == null) {
                return
            }

            inputArguments = Array.isArray(inputArguments) ? inputArguments : [inputArguments]

            inputArguments.forEach((inputArg, index) => {
                let paramDoc = ''
                if (inputArg.purpose != null) {
                    paramDoc += inputArg.purpose
                }
                if (inputArg.valueSummary != null) {
                    paramDoc += (paramDoc.length > 0 ? '\n' : '') + inputArg.valueSummary
                }

                const paramDocArgs = paramDoc.length > 0 ? [paramDoc] : []
                params.push(ParameterInformation.create(inputArg.name, ...paramDocArgs))

                argNames.push(inputArg.name)
                if (inputArg.status === 'presenting') {
                    signatureHelp.activeParameter = index
                }
            })

            let argStr = ''
            if (argNames.length === 1) {
                argStr = argNames[0]
            } else if (argNames.length > 1) {
                argStr = argNames.join(', ')
            }

            // Handle function outputs
            let outStr = ''
            let outputArguments = sigData.outputArguments
            if (outputArguments != null) {
                outputArguments = Array.isArray(outputArguments) ? outputArguments : [outputArguments]
                outStr = outputArguments.length === 1
                    ? outputArguments[0].name
                    : `[${outputArguments.map(output => output.name).join(', ')}]`
                outStr += ' = '
            }

            const id = `${outStr}${sigData.functionName}(${argStr})`
            signatureHelp.signatures.push(SignatureInformation.create(
                id,
                undefined,
                ...params
            ))
        })

        return signatureHelp
    }
}

export default new CompletionProvider()
