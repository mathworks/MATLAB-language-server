// Copyright 2024 The MathWorks, Inc.

import Logger from '../logging/Logger'
import NotificationService, { Notification } from '../notifications/NotificationService'

const ORIGINAL_MIN_RELEASE = 'R2021a'
const CURRENT_MIN_RELEASE = 'R2021a'
const FUTURE_MIN_RELEASE = 'R2021b'

enum DeprecationType {
    NEVER_SUPPORTED = 1,
    DEPRECATED = 2,
    TO_BE_DEPRECATED = 3
}

/**
 * Checks if the given MATLAB release is unsupported, has been deprecated, or is planned
 * for deprecation in a future release. If it falls under one of these categories, a
 * notification is sent to the client, which may display a message to the user.
 *
 * @param matlabRelease The MATLAB release (e.g. "R2021a") which is being checked
 */
export function checkIfMatlabDeprecated (matlabRelease: string): void {
    let deprecationType: DeprecationType

    if (matlabRelease < ORIGINAL_MIN_RELEASE) {
        // The launched MATLAB version has never been supported
        deprecationType = DeprecationType.NEVER_SUPPORTED
        Logger.error(`MATLAB ${matlabRelease} is not supported`)
    } else if (matlabRelease >= ORIGINAL_MIN_RELEASE && matlabRelease < CURRENT_MIN_RELEASE) {
        // The launched MATLAB version is no longer supported
        deprecationType = DeprecationType.DEPRECATED
        Logger.error(`MATLAB ${matlabRelease} is no longer supported`)
    } else if (matlabRelease >= CURRENT_MIN_RELEASE && matlabRelease < FUTURE_MIN_RELEASE) {
        // Support for the launched MATLAB version will end in an upcoming release
        deprecationType = DeprecationType.TO_BE_DEPRECATED
        Logger.warn(`Support for MATLAB ${matlabRelease} will end in a future update`)
    } else {
        // Support for the launched MATLAB version is not yet planned to end
        return
    }

    let message = {
        deprecationType: deprecationType,
        deprecationInfo: {
            matlabVersion: matlabRelease,
            minVersion: CURRENT_MIN_RELEASE,
            futureMinVersion: FUTURE_MIN_RELEASE
        }
    }

    NotificationService.sendNotification(Notification.MatlabVersionDeprecation, message)
}
