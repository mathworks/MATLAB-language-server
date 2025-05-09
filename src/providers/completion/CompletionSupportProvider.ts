// Copyright 2022 - 2025 The MathWorks, Inc.

import { CompletionItem, CompletionItemKind, CompletionList, CompletionParams, ParameterInformation, Position, SignatureHelp, SignatureHelpParams, SignatureInformation, TextDocuments, InsertTextFormat } from 'vscode-languageserver'
import { TextDocument } from 'vscode-languageserver-textdocument'
import MatlabLifecycleManager from '../../lifecycle/MatlabLifecycleManager'
import ConfigurationManager, { Argument } from '../../lifecycle/ConfigurationManager'
import MVM from '../../mvm/impl/MVM'
import Logger from '../../logging/Logger'
import parse from '../../mvm/MdaParser'
import * as FileNameUtils from '../../utils/FileNameUtils'

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
    attribute: CompletionItemKind.Keyword,
    codeSnippet: CompletionItemKind.Snippet
}

/**
 * Handles requests for completion-related features.
 * Currently, this handles auto-completion as well as function signature help.
 */
class CompletionSupportProvider {
    constructor (private readonly matlabLifecycleManager: MatlabLifecycleManager, private readonly mvm: MVM) {}

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

        const completionData = await this.retrieveCompletionDataForDocument(doc, params.position)

        return this.parseCompletionItems(completionData)
    }

    /**
     * Returns completions for a give string
     * @returns An array of possible completions
     */
    async getCompletions (code: string, cursorOffset: number): Promise<CompletionList> {
        const completionData = await this.retrieveCompletionData(code, '', cursorOffset);

        return this.parseCompletionItems(completionData);
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

        const completionData = await this.retrieveCompletionDataForDocument(doc, params.position)

        return this.parseSignatureHelp(completionData)
    }

    /**
     * Retrieves raw completion data from MATLAB.
     *
     * @param doc The text document
     * @param position The cursor position in the document
     * @returns The raw completion data
     */
    private async retrieveCompletionDataForDocument (doc: TextDocument, position: Position): Promise<MCompletionData> {
        const docUri = doc.uri

        const code = doc.getText()
        const fileName = FileNameUtils.getFilePathFromUri(docUri, true)
        const cursorPosition = doc.offsetAt(position)

        return await this.retrieveCompletionData(code, fileName, cursorPosition);
    }

    /**
     * Retrieves raw completion data from MATLAB.
     *
     * @param code The code to be completed
     * @param fileName The name of the file with the completion, or empty string if there is no file
     * @param cursorPosition The cursor position in the code
     * @returns The raw completion data
     */
    private async retrieveCompletionData (code: string, fileName: string, cursorPosition: number): Promise<MCompletionData> {
        if (!this.mvm.isReady()) {
            // MVM not yet ready
            return {}
        }

        try {
            const response = await this.mvm.feval(
                'matlabls.handlers.completions.getCompletions',
                1,
                [code, fileName, cursorPosition]
            )

            if ('error' in response) {
                // Handle MVMError
                Logger.error('Error received while retrieving completion data:')
                Logger.error(response.error.msg)
                return {}
            }

            return parse(response.result[0]) as MCompletionData
        } catch (err) {
            Logger.error('Error caught while retrieving completion data:')
            Logger.error(err as string)
            return {}
        }
    }

    /**
     * Parses the raw completion data to extract possible auto-completions.
     *
     * @param completionData The raw completion data
     * @returns A list of completion items
     */
    private parseCompletionItems (completionData: MCompletionData): CompletionList {
        const completionItems: CompletionItem[] = []

        const completionsMap = new Map<string, { kind: CompletionItemKind, doc: string, insertText: string }>()

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
            if (completionData.kind === CompletionItemKind.Snippet) {
                completionItem.insertText = completionData.insertText
                completionItem.insertTextFormat = InsertTextFormat.Snippet
            }
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
    private gatherCompletions (completionDataObj: MCompletionData | MArgumentData, completionMap: Map<string, { kind: CompletionItemKind, doc: string, insertText: string }>): void {
        let choices = completionDataObj.widgetData?.choices
        if (choices == null) {
            return
        }

        choices = Array.isArray(choices) ? choices : [choices]

        choices = this.filterSnippetChoices(choices);

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
                case 'codeSnippet':
                    completion = choice.displayString ?? ''
                    break
            }

            if (choice.matchType !== 'codeSnippet') {
                const dotIdx = choice.completion.lastIndexOf('.')
                if (dotIdx > 0 && !isPath) {
                    completion = completion.slice(dotIdx + 1)
                }
            }

            completionMap.set(completion, {
                kind: MatlabCompletionToKind[choice.matchType] ?? CompletionItemKind.Function,
                doc: choice.purpose,
                insertText: choice.completion ?? ''
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

    /**
     * Filters out the snippet choices from the list of choices based on the configured snippet ignore list.
     *
     * @param choices The list of completion choices to filter
     * @returns The list of completion choices with snippet choices filtered out based on the configured snippet ignore list
     */
    private filterSnippetChoices (choices: MCompletionChoice[]): MCompletionChoice[] {
        // Get the snippet ignore list from the configuration manager
        const snippetIgnoreList = ConfigurationManager.getArgument(Argument.SnippetIgnoreList).split(';');
        return choices.filter(choice => {
            return choice.matchType !== 'codeSnippet' || (choice.displayString !== undefined && !snippetIgnoreList.includes(choice.displayString));
        });
    }
}

export default CompletionSupportProvider
