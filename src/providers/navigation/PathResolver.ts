// Copyright 2022 - 2024 The MathWorks, Inc.

import { URI } from 'vscode-uri'
import { MatlabConnection } from '../../lifecycle/MatlabCommunicationManager'

interface ResolvePathResponse {
    data: ResolvedPath[]
}

interface ResolvedPath {
    name: string
    path: string
}

interface ResolvedUri {
    name: string
    uri: string
}

class PathResolver {
    private readonly REQUEST_CHANNEL = '/matlabls/navigation/resolvePath/request'
    private readonly RESPONSE_CHANNEL = '/matlabls/navigation/resolvePath/response'

    /**
     * Attempts to resolve the given names to the files in which the names are defined.
     * For example, 'MyClass' may be resolved to 'file:///path/to/MyClass.m'.
     *
     * @param names The names which should be resolved to paths
     * @param contextFileUri The file from which the context of the path resolution should be made
     * @param matlabConnection The connection to MATLAB®
     *
     * @returns The resolved URIs. Any URIs which could not be determiend are denoted by empty strings.
     */
    async resolvePaths (names: string[], contextFileUri: string, matlabConnection: MatlabConnection): Promise<ResolvedUri[]> {
        const contextFile = URI.parse(contextFileUri).fsPath

        return await new Promise(resolve => {
            const channelId = matlabConnection.getChannelId()
            const channel = `${this.RESPONSE_CHANNEL}/${channelId}`
            const responseSub = matlabConnection.subscribe(channel, message => {
                matlabConnection.unsubscribe(responseSub)

                const resolvedPaths = (message as ResolvePathResponse).data

                // Convert file system paths from MATLAB to URIs
                const resolvedUris: ResolvedUri[] = resolvedPaths.map(resolvedPath => {
                    const filePath = resolvedPath.path
                    const uri = (filePath === '') ? '' : URI.file(filePath).toString()
                    return {
                        name: resolvedPath.name,
                        uri
                    }
                })

                resolve(resolvedUris)
            })

            matlabConnection.publish(this.REQUEST_CHANNEL, {
                names,
                contextFile,
                channelId
            })
        })
    }
}

export default new PathResolver()
