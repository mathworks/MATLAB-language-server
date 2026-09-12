// Copyright 2022 - 2026 The MathWorks, Inc.

import { DidChangeConfigurationNotification, DidChangeConfigurationParams } from 'vscode-languageserver'
import ClientCapabilitiesManager from './ClientCapabilitiesManager'
import { reportTelemetrySettingsChange } from '../logging/TelemetryUtils'
import { getCliArgs } from '../utils/CliUtils'
import ClientConnection from '../ClientConnection'

export enum Argument {
    // Basic arguments
    MatlabLaunchCommandArguments = 'matlabLaunchCommandArgs',
    MatlabInstallationPath = 'matlabInstallPath',
    MatlabConnectionTiming = 'matlabConnectionTiming',

    ShouldIndexWorkspace = 'indexWorkspace',
    IndexDocumentation = 'indexDocumentation',

    // Advanced arguments
    MatlabUrl = 'matlabUrl',

    SnippetIgnoreList = 'snippetIgnoreList'
}

export enum ConnectionTiming {
    OnStart = 'onStart',
    OnDemand = 'onDemand',
    Never = 'never'
}

export enum DocumentationIndexTiming {
    OnMissing = 'onMissing',
    Never = 'never',
    Always = 'always'
}

export function normalizeDocumentationIndexTiming (value: unknown): DocumentationIndexTiming {
    if (value === false || value === 'never' || value === 'Never') {
        return DocumentationIndexTiming.Never
    }
    if (value === 'always' || value === 'Always') {
        return DocumentationIndexTiming.Always
    }
    return DocumentationIndexTiming.OnMissing
}

interface CliArguments {
    [Argument.MatlabLaunchCommandArguments]: string
    [Argument.MatlabUrl]: string
    [Argument.SnippetIgnoreList]: string
}

export interface Settings {
    installPath: string
    matlabConnectionTiming: ConnectionTiming
    indexWorkspace: boolean
    indexDocumentation: DocumentationIndexTiming
    telemetry: boolean
    maxFileSizeForAnalysis: number
    signIn: boolean
    prewarmGraphics: boolean
    defaultEditor: boolean
    [otherKey: string]: any // Other settings not explicitly used by the language server
}

const DEFAULT_SETTINGS: Settings = {
    installPath: '',
    matlabConnectionTiming: ConnectionTiming.OnStart,
    indexWorkspace: false,
    indexDocumentation: DocumentationIndexTiming.OnMissing,
    telemetry: true,
    maxFileSizeForAnalysis: 0,
    signIn: false,
    prewarmGraphics: true,
    defaultEditor: true
}

export class ConfigurationManager {
    private static instance: ConfigurationManager

    private settings: Settings
    private hasFetchedInitialConfiguration = false

    // Holds additional command line arguments that are not part of the configuration
    private readonly additionalArguments: CliArguments

    private hasConfigurationCapability = false

    // Map to keep track of callbacks to execute when a specific setting changes
    private readonly settingChangeCallbacks: Map<string, (configuration: Settings) => void> = new Map();

    constructor () {
        const cliArgs = getCliArgs()

        this.settings = {
            installPath: cliArgs[Argument.MatlabInstallationPath] ?? DEFAULT_SETTINGS.installPath,
            matlabConnectionTiming: cliArgs[Argument.MatlabConnectionTiming] as ConnectionTiming ?? DEFAULT_SETTINGS.matlabConnectionTiming,
            indexWorkspace: cliArgs[Argument.ShouldIndexWorkspace] ?? DEFAULT_SETTINGS.indexWorkspace,
            indexDocumentation: cliArgs[Argument.IndexDocumentation] != null
                ? normalizeDocumentationIndexTiming(cliArgs[Argument.IndexDocumentation])
                : DEFAULT_SETTINGS.indexDocumentation,
            telemetry: DEFAULT_SETTINGS.telemetry,
            maxFileSizeForAnalysis: DEFAULT_SETTINGS.maxFileSizeForAnalysis,
            signIn: DEFAULT_SETTINGS.signIn,
            prewarmGraphics: DEFAULT_SETTINGS.prewarmGraphics,
            defaultEditor: DEFAULT_SETTINGS.defaultEditor
        }

        this.additionalArguments = {
            [Argument.MatlabLaunchCommandArguments]: cliArgs[Argument.MatlabLaunchCommandArguments] ?? '',
            [Argument.MatlabUrl]: cliArgs[Argument.MatlabUrl] ?? '',
            [Argument.SnippetIgnoreList]: cliArgs[Argument.SnippetIgnoreList] ?? ''
        }
    }

    public static getInstance (): ConfigurationManager {
        if (ConfigurationManager.instance == null) {
            ConfigurationManager.instance = new ConfigurationManager()
        }

        return ConfigurationManager.instance
    }

    /**
     * Sets up the configuration manager
     */
    setup (): void {
        const connection = ClientConnection.getConnection()

        this.hasConfigurationCapability = ClientCapabilitiesManager.hasWorkspaceConfiguration()

        if (ClientCapabilitiesManager.hasDynamicConfigurationRegistration()) {
            void connection.client.register(DidChangeConfigurationNotification.type)
        }

        connection.onDidChangeConfiguration(params => { void this.handleConfigurationChanged(params) })
    }

    /**
     * Registers a callback for setting changes.
     *
     * @param settingName - The setting to listen for.
     * @param onSettingChangeCallback - The callback invoked on setting change.
     * @throws {Error} For invalid setting names.
     */
    addSettingCallback (settingName: string, onSettingChangeCallback: (configuration: Settings) => void | Promise<void>): void {
        if (this.settingChangeCallbacks.get(settingName) == null) {
            this.settingChangeCallbacks.set(settingName, onSettingChangeCallback)
        }
    }

    /**
     * Gets the configuration for the language server
     *
     * @returns The current configuration
     */
    async getConfiguration (): Promise<Settings> {
        if (this.hasConfigurationCapability && !this.hasFetchedInitialConfiguration) {
            await this.fetchConfiguration()
        }

        return this.settings
    }

    /**
     * Fetches the workspace configuration from the client and merges it into
     * the current settings. The workspace configuration takes priority over
     * the CLI-seeded initial values.
     */
    private async fetchConfiguration (): Promise<void> {
        const connection = ClientConnection.getConnection()
        const configuration = await connection.workspace.getConfiguration('MATLAB') as Settings
        if (configuration?.indexDocumentation !== undefined) {
            configuration.indexDocumentation = normalizeDocumentationIndexTiming(configuration.indexDocumentation)
        }
        Object.assign(this.settings, configuration)
        this.hasFetchedInitialConfiguration = true
    }

    /**
     * Gets the value of the given argument
     *
     * @param argument The argument
     * @returns The argument's value
     */
    getArgument (argument: Argument.MatlabLaunchCommandArguments | Argument.MatlabUrl | Argument.SnippetIgnoreList): string {
        return this.additionalArguments[argument]
    }

    /**
     * Handles a change in the configuration
     * @param params The configuration changed params
     */
    private async handleConfigurationChanged (params: DidChangeConfigurationParams): Promise<void> {
        // If the initial configuration has not yet been fetched, skip the
        // comparison — the "old" values are just the CLI-seeded defaults and
        // there are no meaningful callbacks to fire.
        const shouldCompare = !this.hasConfigurationCapability || this.hasFetchedInitialConfiguration

        const oldConfig = { ...this.settings }

        if (this.hasConfigurationCapability) {
            await this.fetchConfiguration()
        } else {
            const rawSettings = params.settings?.MATLAB ?? this.settings
            if (rawSettings?.indexDocumentation !== undefined) {
                rawSettings.indexDocumentation = normalizeDocumentationIndexTiming(rawSettings.indexDocumentation)
            }
            this.settings = rawSettings
        }

        if (shouldCompare) {
            this.compareSettingChanges(oldConfig, this.settings)
        }
    }

    private compareSettingChanges (oldConfiguration: Settings, newConfiguration: Settings): void {
        const keys = Object.keys(oldConfiguration)

        for (let i = 0; i < keys.length; i++) {
            const settingName = keys[i]
            const oldValue = oldConfiguration[settingName]
            const newValue = newConfiguration[settingName]

            if (oldValue !== newValue) {
                reportTelemetrySettingsChange(settingName, newValue.toString(), oldValue.toString())

                // As the setting changed, execute the corresponding callback for it.
                const callback = this.settingChangeCallbacks.get(settingName);
                if (callback != null) {
                    callback(newConfiguration)
                }
            }
        }
    }
}

export default ConfigurationManager.getInstance()
