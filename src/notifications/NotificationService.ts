// Copyright 2022 - 2023 The MathWorks, Inc.

import { GenericNotificationHandler } from 'vscode-languageserver'
import { connection } from '../server'

export enum Notification {
    // Connection Status Updates
    MatlabConnectionClientUpdate = 'matlab/connection/update/client',
    MatlabConnectionServerUpdate = 'matlab/connection/update/server',

    // Errors
    MatlabLaunchFailed = 'matlab/launchfailed',
    MatlabFeatureUnavailable = 'feature/needsmatlab',
    MatlabFeatureUnavailableNoMatlab = 'feature/needsmatlab/nomatlab',

    // Telemetry
    LogTelemetryData = 'telemetry/logdata'
}

class NotificationService {
    /**
     * Sends a notification to the language client
     *
     * @param name The name of the notification
     * @param params Any parameters to send with the notification
     */
    sendNotification (name: string, params?: unknown): void {
        void connection.sendNotification(name, params)
    }

    /**
     * Sets up a listener for notifications from the language client
     *
     * @param name The name of the notification
     * @param callback The callback
     */
    registerNotificationListener (name: string, callback: GenericNotificationHandler): void {
        connection.onNotification(name, callback)
    }
}

export default new NotificationService()
