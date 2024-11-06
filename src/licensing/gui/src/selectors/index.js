// Copyright 2024 The MathWorks, Inc.

import { createSelector } from 'reselect';
import { STATUS_REQUEST_INTERVAL_MS, MAX_REQUEST_FAIL_COUNT } from '../constants';

export const selectServerStatus = state => state.serverStatus;
export const selectMatlabVersionOnPath = state => state.matlab.versionOnPath;
export const selectEnvConfig = state => state.envConfig;
export const selectWsEnv = state => state.serverStatus.wsEnv;
export const selectSubmittingServerStatus = state => state.serverStatus.isSubmitting;
export const selectHasFetchedServerStatus = state => state.serverStatus.hasFetched;
export const selectIsFetchingServerStatus = state => state.serverStatus.isFetchingServerStatus;
export const selectLicensingInfo = state => state.serverStatus.licensingInfo;
export const selectServerStatusFetchFailCount = state => state.serverStatus.fetchFailCount;
export const selectError = state => state.error;
export const selectWarnings = state => state.warnings;
export const selectAuthEnabled = state => state.authentication.enabled;
export const selectAuthToken = state => state.authentication.token;
export const selectIsAuthenticated = state => state.authentication.status === true;

export const selectHasFetchedEnvConfig = createSelector(
    selectEnvConfig,
    envConfig => envConfig !== null 
);

export const selectIsError = createSelector(
    selectError,
    error => error !== null
);


export const selectIsConnectionError = createSelector(
    selectServerStatusFetchFailCount,
    (fails) => { return fails >= MAX_REQUEST_FAIL_COUNT }
);

export const selectOverlayHidable = createSelector(
    selectIsError,
    selectAuthEnabled,
    selectIsAuthenticated,
    (isError, authRequired, isAuthenticated) => (!isError && (!authRequired || isAuthenticated))
);

export const selectOverlayVisibility = createSelector(
    state => state.overlayVisibility,
    selectIsError,
    selectAuthEnabled,
    selectIsAuthenticated,
    (visibility,isError, authRequired, isAuthenticated) => (
        (authRequired && !isAuthenticated) || visibility || isError
    )
);

export const getFetchAbortController = createSelector(
    selectServerStatus,
    serverStatus => serverStatus.fetchAbortController
);

// If the session is concurrent or if there is a connection error then disable the fetching of data such as get_status.
export const selectFetchStatusPeriod = createSelector(
    selectSubmittingServerStatus,
    selectIsFetchingServerStatus,
    // selectIsConcurrencyEnabled,
    // selectIsConcurrent,
    // (isSubmitting, isFetchingServerStatus, isConcurrencyEnabled, isConcurrent) => {
    //     if (isSubmitting || isFetchingServerStatus || (isConcurrencyEnabled && isConcurrent)) {
    //         return null;
    //     }
    //     return STATUS_REQUEST_INTERVAL_MS; // milliseconds
    // }
    (isSubmitting, isFetchingServerStatus) => {
        if (isSubmitting || isFetchingServerStatus ) {
            return null;
        }
        return STATUS_REQUEST_INTERVAL_MS; // milliseconds
    }
);

export const selectLicensingProvided = createSelector(
    selectLicensingInfo,
    licensingInfo => Object.prototype.hasOwnProperty.call(licensingInfo, 'type')
);

export const selectLicensingIsMhlm = createSelector(
    selectLicensingInfo,
    selectLicensingProvided,
    (licensingInfo, licensingProvided) => licensingProvided && licensingInfo.type === 'mhlm'
);

export const selectLicensingIsNlm = createSelector(
    selectLicensingInfo,
    selectLicensingProvided,
    (licensingInfo, licensingProvided) => licensingProvided && licensingInfo.type === 'nlm'
);

export const selectLicensingIsExistingLicense = createSelector(
    selectLicensingInfo,
    selectLicensingProvided,
    (licensingInfo, licensingProvided) => licensingProvided && licensingInfo.type === 'existing_license'
);

export const selectLicensingMhlmUsername = createSelector(
    selectLicensingInfo,
    selectLicensingIsMhlm,
    (licensingInfo, isMhlm) => isMhlm ? licensingInfo.emailAddress : ''
);

export const selectLicensingNLMConnectionString = createSelector(
    selectLicensingInfo,
    selectLicensingIsNlm,
    (licensingInfo, isNlm) => isNlm ? licensingInfo.connectionString : ''
);

// Selector to check if the license type is mhlm and entitlements property is not empty
export const selectLicensingMhlmHasEntitlements = createSelector(
    selectLicensingIsMhlm,
    selectLicensingInfo,
    (isMhlm, licensingInfo) => isMhlm && licensingInfo.entitlements && licensingInfo.entitlements.length > 0
);

export const selectIsEntitled = createSelector(
    selectLicensingInfo,
    selectLicensingMhlmHasEntitlements,
    (licensingInfo, entitlementIdInfo) => entitlementIdInfo && licensingInfo.entitlementId
);

// TODO Are these overkill? Perhaps just selecting status would be enough
// TODO Could be used for detected intermediate failures, such as server being
// temporarily inaccessible
// export const selectMatlabPending = createSelector(
//     selectMatlabStatus,
//     matlabStatus => matlabStatus === 'starting'
// );

export const selectOverlayVisible = createSelector(
    selectOverlayVisibility,
    selectIsError,
    (visibility, isError) => (visibility || isError)
);

export const selectIsInvalidTokenError = createSelector(
    selectAuthEnabled,
    selectIsAuthenticated,
    selectIsError,
    selectError,
    (authEnabled, isAuthenticated, isError, error) => {
        if ((authEnabled && !isAuthenticated) && isError && error.type === "InvalidTokenError") {
            return true
        }
        return false
    }
)

export const selectInformationDetails = createSelector(
    selectIsError,
    selectError,
    selectAuthEnabled,
    selectIsAuthenticated,
    selectIsInvalidTokenError,
    (isError, error, authEnabled, isAuthenticated, isInvalidTokenError) => {
        
        // Check for any errors on the front-end 
        // to see if HTTP Requests are timing out.       
        if (isError && error.statusCode === 408) {
            return {
                icon: 'warning',
                alert: 'warning',
                label: 'Unknown',
            }
        }

        if (isError && authEnabled && isInvalidTokenError) {
            return {
                icon: 'warning',
                alert: 'warning',
                label: 'Invalid Token supplied',
            }
        }

        if(isError){
            if(error.statusCode === 408){
                return {
                    icon: 'warning',
                    alert: 'warning',
                    label: 'Unknown',
                } 
            } else if( authEnabled && isInvalidTokenError){
                return {
                    icon: 'warning',
                    alert: 'warning',
                    label: 'Invalid Token supplied',
                }
            } else {
                return {
                    icon: 'warning',
                    alert: 'warning',
                    label: error,
                } 
            }

        } else {

            if (authEnabled ) {
                if(isAuthenticated){
                    return {
                        label: 'Success',
                        icon: 'success',
                        alert: 'success'
                    }
                } else {
                    return {
                        label: 'Success',
                        icon: 'info-reverse',
                        alert: 'info'
                    }
                }
                
            }
            
        }

        return {
            label: 'Success',
            icon: 'info-reverse',
            alert: 'info'
        }

        // Check status of MATLAB for errors
        // switch (matlabStatus) {
        //     case 'up':
        //         return {
        //             label: 'Running',
        //             icon: 'success',
        //             alert: 'success'
        //         };
        //     case 'starting':
        //         return {
        //             label: 'Starting. This may take several minutes.',
        //             icon: 'info-reverse',
        //             alert: 'info',
        //             spinner: true
        //         };

        //     case 'stopping':
        //         return {
        //             label: 'Stopping',
        //             icon: 'info-reverse',
        //             alert: 'info',
        //             spinner: true
        //         };
        //     case 'down':
        //         const detail = {
        //             label: 'Not running',
        //             icon: 'info-reverse',
        //             alert: 'info'
        //         };
        //         if (isError) {
        //             detail.icon = 'error';
        //             detail.alert = 'danger';
        //         }
        //         return detail;
        //     default:
        //         throw new Error(`Unknown MATLAB status: "${matlabStatus}".`);
        // }

    }
);
