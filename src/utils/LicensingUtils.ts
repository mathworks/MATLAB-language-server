// Copyright 2024 The MathWorks, Inc.

import { AppError } from '../licensing/errors';
import { Entitlement, MHLMLicenseType, NLMLicenseType, LicensingData, ExistingLicenseType, ErrorResponse, LicensingInfoResponse } from '../licensing/types';
import { Disposable } from 'vscode-languageserver';
import Licensing from '../licensing';
import { setInstallPath, staticFolderPath } from '../licensing/config'
import NotificationService, { Notification } from '../notifications/NotificationService';
import { Settings } from '../lifecycle/ConfigurationManager';
import Logger from '../logging/Logger';

import { startLicensingServer } from '../licensing/server'
import MatlabLifecycleManager from '../lifecycle/MatlabLifecycleManager';

/**
 * Recursively finds all occurrences of the "entitlement" key in the given object and its nested objects.
 *
 * @param obj - The object to search.
 * @returns {Entitlement[][]} An array of arrays containing the entitlement values found.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
export function findAllEntitlements (obj: any): Entitlement[][] {
    const result: Entitlement[][] = [];
    const keyToFind = 'entitlement'

    function recursiveSearch (obj: any): void {
        if (obj === null || obj === undefined || typeof obj !== 'object') {
            return;
        }

        if (Object.prototype.hasOwnProperty.call(obj, keyToFind)) {
            const entitlementValue = (obj as Record<string, unknown>)[keyToFind];
            if (Array.isArray(entitlementValue)) {
                result.push(entitlementValue as Entitlement[]);
            }
        }

        for (const key in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, key)) {
                recursiveSearch((obj as Record<string, unknown>)[key]);
            }
        }
    }

    recursiveSearch(obj);
    return result;
}

/**
 * Marshals the licensing data into a standardized format based on the license type.
 *
 * @param data - The licensing data to be marshaled.
 * @returns {Object} The marshaled licensing information.
 */
export function marshalLicensingInfo (data: LicensingData): LicensingInfoResponse {
    if ((data == null) || !('type' in data)) {
        return {}
    }

    if (data.type === MHLMLicenseType) {
        return {
            type: MHLMLicenseType,
            emailAddress: data.email_addr,
            entitlements: data.entitlements,
            entitlementId: data.entitlement_id
        }
    } else if (data.type === NLMLicenseType) {
        return {
            type: NLMLicenseType,
            connectionString: data.conn_str
        }
    } else if (data.type === ExistingLicenseType) {
        return {
            type: ExistingLicenseType
        }
    } else {
        return {}
    }
}

/**
 * Marshals the error information into a standardized format.
 *
 * @param error - The error object to be marshaled.
 * @returns The marshaled error information, or null if no error is provided.
 */
export function marshalErrorInfo (error: AppError | null): ErrorResponse {
    if (error == null) return null;

    return {
        message: error.message,
        logs: error.logs,
        type: error.constructor.name
    }
}

let licensingDeleteNotificationListener: Disposable | null = null;
let licensingServerUrlNotificationListener: Disposable | null = null;
let mLM: MatlabLifecycleManager;

/**
 * Sets up notification listeners required for licensing and updates languageserver client
 *
 */
export async function setupLicensingNotificationListenersAndUpdateClient (matlabLifecycleManager: MatlabLifecycleManager): Promise<void> {
    const licensing = new Licensing()
    mLM = matlabLifecycleManager;
    if (licensingDeleteNotificationListener == null) {
        licensingDeleteNotificationListener = NotificationService.registerNotificationListener(
            Notification.LicensingDelete,
            // eslint-disable-next-line @typescript-eslint/no-misused-promises
            async () => {
                Logger.log('Received notification to delete licensing from the extension')
                await licensing.unsetLicensing()
                // Update language client
                NotificationService.sendNotification(Notification.LicensingData, licensing.getMinimalLicensingInfo())
            }
        )
    }

    if (licensingServerUrlNotificationListener == null) {
        licensingServerUrlNotificationListener = NotificationService.registerNotificationListener(
            Notification.LicensingServerUrl,
            async () => {
                const url = await startLicensingServer(staticFolderPath, mLM);
                Logger.log(`Received Notification requesting for licensing server url: ${url}`)
                // Update language client
                NotificationService.sendNotification(Notification.LicensingServerUrl, url)
            }
        )
    }

    NotificationService.sendNotification(Notification.LicensingData, licensing.getMinimalLicensingInfo())
}

/**
 * Removes notification listeners required for licensing and updates languageserver client
 *
 */
export function removeLicensingNotificationListenersAndUpdateClient (): void {
    if (licensingDeleteNotificationListener != null) {
        licensingDeleteNotificationListener.dispose()
        licensingDeleteNotificationListener = null
    }

    if (licensingServerUrlNotificationListener != null) {
        licensingServerUrlNotificationListener.dispose()
        licensingServerUrlNotificationListener = null
    }
}

/**
 * Handles the changes to the "signIn" setting in the configuration.
 *
 * @param configuration - The configuration object.
 * @returns {Promise<void>} A Promise that resolves when the handling is complete.
 */
export async function handleSignInChanged (configuration: Settings): Promise<void> {
    if (configuration.signIn) {
        await setupLicensingNotificationListenersAndUpdateClient(mLM)
    } else {
        removeLicensingNotificationListenersAndUpdateClient()
    }
}

/**
 * Handles the changes to the "installPath" setting in the configuration.
 *
 * @param configuration - The configuration object.
 */
export function handleInstallPathSettingChanged (configuration: Settings): void {
    setInstallPath(configuration.installPath)
    const licensing = new Licensing()

    // Entitlements are based on the MATLAB version
    // As installPath is changed, we need to update the entitlements using the
    // new MATLAB version.
    if (licensing.isMHLMLicensing()) {
        licensing.updateAndPersistLicensing().then(isSuccessful => {
            if (isSuccessful) {
                Logger.log('Successfully updated entitlements using the new MATLAB version')
            } else {
                Logger.log('Failed to update entitlements using the new MATLAB version')
            }
        }, () => {})
    }
}
