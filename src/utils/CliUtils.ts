// Copyright 2022 - 2023 The MathWorks, Inc.

import * as yargs from 'yargs'
import { Argument } from '../lifecycle/ConfigurationManager'

export interface CliArgs {
    [Argument.MatlabLaunchCommandArguments]?: string
    [Argument.MatlabCertificateDirectory]?: string
    [Argument.MatlabInstallationPath]?: string
    [Argument.MatlabConnectionTiming]?: string
    [Argument.ShouldIndexWorkspace]?: boolean
    [Argument.MatlabUrl]?: string
}

/**
 * Creates a yargs parser to extract command line arguments.
 *
 * @returns The parsed command line arguments
 */
function makeParser (): yargs.Argv<CliArgs> {
    const argParser = yargs.option(Argument.MatlabLaunchCommandArguments, {
        description: 'Arguments passed to MATLAB when launching',
        type: 'string',
        requiresArg: true
    }).option(Argument.MatlabCertificateDirectory, {
        description: 'Location at which to look for a MATLAB certificate',
        type: 'string'
    }).option(Argument.MatlabInstallationPath, {
        description: 'The full path to the top-level directory of the MATLAB installation. If not specified, the environment path will be checked for the location of the `matlab` executable.',
        type: 'string',
        default: ''
    }).option(Argument.MatlabConnectionTiming, {
        description: 'When the language server should attempt to connect to MATLAB.',
        type: 'string',
        default: 'onStart',
        choices: ['onStart', 'onDemand', 'never']
    }).option(Argument.ShouldIndexWorkspace, {
        boolean: true,
        default: false,
        description: 'Whether or not the user\'s workspace should be indexed.',
        requiresArg: false
    }).option(Argument.MatlabUrl, {
        type: 'string',
        description: 'URL for communicating with an existing MATLAB instance',
        requiresArg: true
    }).usage(
        'Usage: $0 {--node-ipc | --stdio | --socket=socket} options\n' +
        '\n' +
        '\tAn LSP server for MATLAB. This is meant to be invoked from an editor or IDE.\n'
    ).group(
        ['node-ipc', 'stdio', 'socket'],
        'Required IPC flag'
    ).option('node-ipc', {
        description: 'Use Node IPC'
    }).option('stdio', {
        description: 'Use stdio for IPC'
    }).option('socket', {
        description: 'Use specified socket for IPC',
        requiresArg: true
    }).help('help').alias('h', 'help')

    return argParser
}

/**
 * Parse the command line arguments.
 *
 * @param args If provided, these are the arguments to parse. Otherwise, the true
 * command line arguments will be parsed. This is primarily meant for testing.
 * @returns The parsed CLI arguments
 */
export function getCliArgs (args?: string[]): CliArgs {
    const cliParser = makeParser()
    return (args != null) ? cliParser.parseSync(args) : cliParser.parseSync()
}
