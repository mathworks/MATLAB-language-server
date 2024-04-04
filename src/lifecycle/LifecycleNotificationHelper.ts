// Copyright 2022 - 2024 The MathWorks, Inc.

import NotificationService, { Notification } from '../notifications/NotificationService'
import { ConnectionState } from './MatlabSession'

class LifecycleNotificationHelper {
    didMatlabLaunchFail = false

    /**
     * Sends notification to the language client of a change in the MATLAB® connection state.
     *
     * @param connectionStatus The connection state
     */
    notifyConnectionStatusChange (connectionStatus: ConnectionState): void {
        NotificationService.sendNotification(Notification.MatlabConnectionServerUpdate, {
            connectionStatus
        })
    }

    /**
     * Sends notification to the language client to inform user that MATLAB is required for an action.
     */
    notifyMatlabRequirement (): void {
        // Indicate different messages if MATLAB failed to launch (i.e. could not be found)
        const notification = this.didMatlabLaunchFail ? Notification.MatlabFeatureUnavailableNoMatlab : Notification.MatlabFeatureUnavailable
        NotificationService.sendNotification(notification)
    }
}

export default new LifecycleNotificationHelper()
