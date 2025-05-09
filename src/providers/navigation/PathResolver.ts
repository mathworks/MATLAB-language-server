// Copyright 2022 - 2025 The MathWorks, Inc.

import { URI } from 'vscode-uri'
import MVM from '../../mvm/impl/MVM'
import Logger from '../../logging/Logger'
import parse from '../../mvm/MdaParser'
import * as FileNameUtils from '../../utils/FileNameUtils'

class PathResolver {
    constructor (private readonly mvm: MVM) {}

    /**
     * Attempts to resolve the given identifier to the file in which the identifier is defined.
     * For example, 'MyClass' may be resolved to 'file:///path/to/MyClass.m'.
     *
     * @param identifier The identifier which should be resolved to a path
     * @param contextFileUri The file from which the context of the path resolution should be made
     * @param matlabConnection The connection to MATLAB®
     *
     * @returns The resolved URI. If a URI could not be determiend, it is denoted by an empty string.
     */
    async resolvePath (identifier: string, contextFileUri: string): Promise<string | null> {
        if (!this.mvm.isReady()) {
            // MVM not yet ready
            return null
        }

        const contextFile = FileNameUtils.getFilePathFromUri(contextFileUri)

        try {
            const response = await this.mvm.feval(
                'matlabls.handlers.navigation.resolveNameToPath',
                1,
                [identifier, contextFile]
            )

            if ('error' in response) {
                Logger.error('Error received while resolving paths:')
                Logger.error(response.error.msg)
                return null
            }

            const path = parse(response.result[0]) as string

            const uri = (path === '') ? '' : URI.file(path).toString()

            return uri
        } catch (err) {
            Logger.error('Error caught while resolving paths:')
            Logger.error(err as string)
            return null
        }
    }
}

export default PathResolver
