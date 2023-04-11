// Copyright 2023 The MathWorks, Inc.

import NotificationService, { Notification } from '../notifications/NotificationService';

enum EventKeys {
    Action = 'ACTIONS',
    SettingChange = 'SETTING_CHANGE'
}

export enum Actions {
    OpenFile = 'openFile',
    StartMatlab = 'startMATLAB',
    ShutdownMatlab = 'shutdownMATLAB',
    FormatDocument = 'formatDocument',
    GoToReference = 'goToReference',
    GoToDefinition = 'goToDefinition'
}

export enum ActionErrorConditions {
    MatlabUnavailable = 'MATLAB unavailable'
}

/**
 * Reports a telemetry event to the client
 *
 * @param eventKey The event key
 * @param data The event's data
 */
function reportTelemetry(eventKey: string, data: unknown): void {
    NotificationService.sendNotification(Notification.LogTelemetryData, {
        eventKey,
        data
    })
}

/**
 * Reports telemetry about a simple action
 *
 * @param actionType The action's type
 * @param data The action's data
 */
export function reportTelemetryAction(actionType: string, data = ''): void {
    reportTelemetry(EventKeys.Action, {
        action_type: actionType,
        result: data
    })
}

/**
 * Reports telemetry about a settings change
 * 
 * @param settingName The setting's name
 * @param newValue The new value
 * @param oldValue The old value
 */
export function reportTelemetrySettingsChange(settingName: string, newValue: string, oldValue: string): void {
    reportTelemetry(EventKeys.SettingChange, {
        setting_name: settingName,
        new_value: newValue,
        old_value: oldValue
    })
}
