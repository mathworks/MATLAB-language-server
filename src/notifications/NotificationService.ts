// Copyright 2022 - 2025 The MathWorks, Inc.

import { GenericNotificationHandler, Disposable } from 'vscode-languageserver/node'
import ClientConnection from '../ClientConnection'

export enum Notification {
    // Connection Status Updates
    MatlabConnectionClientUpdate = 'matlab/connection/update/client',
    MatlabConnectionServerUpdate = 'matlab/connection/update/server',

    // Errors
    MatlabLaunchFailed = 'matlab/launchfailed',
    MatlabFeatureUnavailable = 'feature/needsmatlab',
    MatlabFeatureUnavailableNoMatlab = 'feature/needsmatlab/nomatlab',

    // MATLAB Version Deprecation
    MatlabVersionDeprecation = 'matlab/version/deprecation',

    // Execution
    MatlabRequestInstance = 'matlab/request',
    TerminalCompletionRequest = 'TerminalCompletionRequest',
    TerminalCompletionResponse = 'TerminalCompletionResponse',

    MVMEvalRequest = 'evalRequest',
    MVMEvalComplete = 'evalResponse',
    MVMFevalRequest = 'fevalRequest',
    MVMFevalComplete = 'fevalResponse',
    MVMSetBreakpointRequest = 'setBreakpointRequest',
    MVMSetBreakpointComplete = 'setBreakpointResponse',
    MVMClearBreakpointRequest = 'clearBreakpointRequest',
    MVMClearBreakpointComplete = 'clearBreakpointResponse',

    MVMText = 'text',
    MVMClc = 'clc',
    MVMPromptChange = 'mvmPromptChange',

    MVMInterruptRequest = 'interruptRequest',
    MVMUnpauseRequest = 'unpauseRequest',

    MVMStateChange = 'mvmStateChange',

    DebuggingStateChange = 'DebuggingStateChange',
    DebugAdaptorRequest = 'DebugAdaptorRequest',
    DebugAdaptorResponse = 'DebugAdaptorResponse',
    DebugAdaptorEvent = 'DebugAdaptorEvent',

    // Telemetry
    LogTelemetryData = 'telemetry/logdata',

    // MATLAB File Sections Updates
    MatlabSections = 'matlab/sections',

    // Licensing
    LicensingServerUrl = 'licensing/server/url',
    LicensingData = 'licensing/data',
    LicensingDelete = 'licensing/delete',
    LicensingError = 'licensing/error',

    // Default Editor
    EditorExecutablePath = 'matlab/otherEditor'
}

class NotificationService {
    private static instance: NotificationService

    public static getInstance (): NotificationService {
        if (NotificationService.instance == null) {
            NotificationService.instance = new NotificationService()
        }

        return NotificationService.instance
    }

    /**
     * Sends a notification to the language client
     *
     * @param name The name of the notification
     * @param params Any parameters to send with the notification
     */
    sendNotification (name: string, params?: unknown): void {
        void ClientConnection.getConnection().sendNotification(name, params)
    }

    /**
     * Registers a notification listener for the specified notification name.
     *
     * @param name - The name of the notification to listen for.
     * @param callback - The callback function that will be invoked when the notification is received.
     * @returns A disposable object that can be used to unregister the notification listener.
     */
    registerNotificationListener (name: string, callback: GenericNotificationHandler): Disposable {
        return ClientConnection.getConnection().onNotification(name, callback)
    }
}

export default NotificationService.getInstance()
