// Copyright 2022 - 2024 The MathWorks, Inc.

import { ClientCapabilities, DidChangeConfigurationNotification, DidChangeConfigurationParams } from 'vscode-languageserver'
import { reportTelemetrySettingsChange } from '../logging/TelemetryUtils'
import { getCliArgs } from '../utils/CliUtils'
import ClientConnection from '../ClientConnection'

export enum Argument {
    // Basic arguments
    MatlabLaunchCommandArguments = 'matlabLaunchCommandArgs',
    MatlabInstallationPath = 'matlabInstallPath',
    MatlabConnectionTiming = 'matlabConnectionTiming',

    ShouldIndexWorkspace = 'indexWorkspace',

    // Advanced arguments
    MatlabUrl = 'matlabUrl',

    SnippetIgnoreList = 'snippetIgnoreList'
}

export enum ConnectionTiming {
    OnStart = 'onStart',
    OnDemand = 'onDemand',
    Never = 'never'
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
    telemetry: boolean
    maxFileSizeForAnalysis: number
    signIn: boolean
}

type SettingName = 'installPath' | 'matlabConnectionTiming' | 'indexWorkspace' | 'telemetry' | 'maxFileSizeForAnalysis' | 'signIn'

const SETTING_NAMES: SettingName[] = [
    'installPath',
    'matlabConnectionTiming',
    'indexWorkspace',
    'telemetry',
    'maxFileSizeForAnalysis',
    'signIn'
]

class ConfigurationManager {
    private static instance: ConfigurationManager

    private configuration: Settings | null = null
    private readonly defaultConfiguration: Settings
    private globalSettings: Settings

    // Holds additional command line arguments that are not part of the configuration
    private readonly additionalArguments: CliArguments

    private hasConfigurationCapability = false

    // Map to keep track of callbacks to execute when a specific setting changes
    private readonly settingChangeCallbacks: Map<SettingName, (configuration: Settings) => void> = new Map();

    constructor () {
        const cliArgs = getCliArgs()

        this.defaultConfiguration = {
            installPath: '',
            matlabConnectionTiming: ConnectionTiming.OnStart,
            indexWorkspace: false,
            telemetry: true,
            maxFileSizeForAnalysis: 0,
            signIn: false
        }

        this.globalSettings = {
            installPath: cliArgs[Argument.MatlabInstallationPath] ?? this.defaultConfiguration.installPath,
            matlabConnectionTiming: cliArgs[Argument.MatlabConnectionTiming] as ConnectionTiming ?? this.defaultConfiguration.matlabConnectionTiming,
            indexWorkspace: cliArgs[Argument.ShouldIndexWorkspace] ?? this.defaultConfiguration.indexWorkspace,
            telemetry: this.defaultConfiguration.telemetry,
            maxFileSizeForAnalysis: this.defaultConfiguration.maxFileSizeForAnalysis,
            signIn: this.defaultConfiguration.signIn
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
     *
     * @param capabilities The client capabilities
     */
    setup (capabilities: ClientCapabilities): void {
        const connection = ClientConnection.getConnection()

        this.hasConfigurationCapability = capabilities.workspace?.configuration != null

        if (this.hasConfigurationCapability) {
            // Register for configuration changes
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
    addSettingCallback (settingName: SettingName, onSettingChangeCallback: (configuration: Settings) => void | Promise<void>): void {
        if (this.settingChangeCallbacks.get(settingName) == null) {
            this.settingChangeCallbacks.set(settingName, onSettingChangeCallback)
        }
    }

    /**
     * Gets the configuration for the langauge server
     *
     * @returns The current configuration
     */
    async getConfiguration (): Promise<Settings> {
        if (this.hasConfigurationCapability) {
            if (this.configuration == null) {
                const connection = ClientConnection.getConnection()
                this.configuration = await connection.workspace.getConfiguration('MATLAB') as Settings
            }

            return Object.assign(this.defaultConfiguration, this.configuration)
        }

        return Object.assign(this.defaultConfiguration, this.globalSettings)
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
        let oldConfig: Settings | null
        let newConfig: Settings

        if (this.hasConfigurationCapability) {
            oldConfig = this.configuration

            // Clear cached configuration
            this.configuration = null

            // Force load new configuration
            newConfig = await this.getConfiguration()
        } else {
            oldConfig = this.globalSettings
            this.globalSettings = params.settings?.matlab ?? this.defaultConfiguration

            newConfig = this.globalSettings
        }

        this.compareSettingChanges(oldConfig, newConfig)
    }

    private compareSettingChanges (oldConfiguration: Settings | null, newConfiguration: Settings): void {
        if (oldConfiguration == null) {
            // Not yet initialized
            return
        }

        for (let i = 0; i < SETTING_NAMES.length; i++) {
            const settingName = SETTING_NAMES[i]
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
