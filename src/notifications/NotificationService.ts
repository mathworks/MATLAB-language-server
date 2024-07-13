// Copyright 2022 - 2024 The MathWorks, Inc.

import { GenericNotificationHandler } from 'vscode-languageserver'
import ClientConnection from '../ClientConnection'

export enum Notification {
    // Connection Status Updates
    MatlabConnectionClientUpdate = 'matlab/connection/update/client',
    MatlabConnectionServerUpdate = 'matlab/connection/update/server',

    // Execution
    MatlabRequestInstance = 'matlab/request',

    MVMEvalRequest = 'evalRequest',
    MVMEvalComplete = 'evalRequest',
    MVMFevalRequest = 'fevalRequest',
    MVMFevalComplete = 'fevalRequest',

    MVMText = 'text',
    MVMClc = 'clc',

    MVMInterruptRequest = 'interruptRequest',

    MVMStateChange = 'mvmStateChange',

    // Errors
    MatlabLaunchFailed = 'matlab/launchfailed',
    MatlabFeatureUnavailable = 'feature/needsmatlab',
    MatlabFeatureUnavailableNoMatlab = 'feature/needsmatlab/nomatlab',

    // MATLAB Version Deprecation
    MatlabVersionDeprecation = 'matlab/version/deprecation',

    // Telemetry
    LogTelemetryData = 'telemetry/logdata'
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
     * Sets up a listener for notifications from the language client
     *
     * @param name The name of the notification
     * @param callback The callback
     */
    registerNotificationListener (name: string, callback: GenericNotificationHandler): void {
        ClientConnection.getConnection().onNotification(name, callback)
    }
}

export default NotificationService.getInstance()
