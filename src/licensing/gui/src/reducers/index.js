// Copyright 2024 The MathWorks, Inc.

import { combineReducers } from 'redux';

// ACTIONS
import {
    SET_OVERLAY_VISIBILITY,
    REQUEST_SERVER_STATUS,
    RECEIVE_SERVER_STATUS,
    REQUEST_SET_LICENSING,
    REQUEST_STOP_MATLAB,
    REQUEST_START_MATLAB,
    REQUEST_ENV_CONFIG,
    RECEIVE_SET_LICENSING,
    RECEIVE_STOP_MATLAB,
    RECEIVE_START_MATLAB,
    RECEIVE_ERROR,
    RECEIVE_ENV_CONFIG,
    SET_AUTH_STATUS,
    SET_AUTH_TOKEN
} from '../actions';

// Stores info on whether token authentication enabled on the backend.
// This is enforced by the backend.
export function authEnabled (state = false, action) {
    switch (action.type) {
        case RECEIVE_ENV_CONFIG:
            return action.config.authentication.enabled;
        default:
            return state;
    }
}

// Stores status of token authentication.
export function authStatus (state = false, action) {
    switch (action.type) {
        case RECEIVE_ENV_CONFIG:
            return action.config.authentication.status;
        case SET_AUTH_STATUS:
            return action.authentication.status;
        default:
            return state;
    }
}

// Stores auth token
export function authToken (state = null, action) {
    switch (action.type) {
        case SET_AUTH_TOKEN:
            return action.authentication.token;
        default:
            return state;
    }
}

export function overlayVisibility(state = true, action) {
    switch (action.type) {
        case SET_OVERLAY_VISIBILITY:
            return action.visibility;
        default:
            return state;
    }
}

export function licensingInfo(state = {}, action) {
    switch (action.type) {
        case RECEIVE_SERVER_STATUS:
        case RECEIVE_SET_LICENSING:
        case RECEIVE_STOP_MATLAB:
        case RECEIVE_START_MATLAB:
            return {
                ...action.status.licensing
            };
        default:
            return state;
    }
}

export function matlabVersionOnPath(state = null, action) {
    switch (action.type) {       
        case RECEIVE_SERVER_STATUS:
        case RECEIVE_SET_LICENSING:
            return action.status.matlab.version;
        case RECEIVE_ENV_CONFIG:
            return action.config.matlab.version;
        default:
            return state;
    }
}


export function wsEnv(state = null, action) {
    switch (action.type) {
        case RECEIVE_SERVER_STATUS:
        case RECEIVE_SET_LICENSING:        
        case RECEIVE_STOP_MATLAB:
        case RECEIVE_START_MATLAB:
            return action.status.wsEnv;
        default:
            return state;
    }
}

export function isFetching(state = false, action) {
    switch (action.type) {
        case REQUEST_SERVER_STATUS:
        case REQUEST_SET_LICENSING:
        case REQUEST_STOP_MATLAB:
        case REQUEST_START_MATLAB:
        case REQUEST_ENV_CONFIG:
            return true;
        case RECEIVE_SERVER_STATUS:
        case RECEIVE_SET_LICENSING:
        case RECEIVE_STOP_MATLAB:
        case RECEIVE_START_MATLAB:
        case RECEIVE_ERROR:
        case RECEIVE_ENV_CONFIG: 
            return false;
        default:
            return state;
    }
}

export function isFetchingServerStatus(state = false, action) {
    switch (action.type) {
        case REQUEST_SERVER_STATUS:
            return true;
        case RECEIVE_SERVER_STATUS:
        case RECEIVE_ERROR:
            return false;
        default:
            return state;
    }
}

export function hasFetched(state = false, action) {
    switch (action.type) {
        case RECEIVE_SERVER_STATUS:
        case RECEIVE_SET_LICENSING:
        case RECEIVE_STOP_MATLAB:
        case RECEIVE_START_MATLAB:
            return true;
        default:
            return state;
    }
}

export function isSubmitting(state = false, action) {
    switch (action.type) {
        case REQUEST_SET_LICENSING:
        case REQUEST_STOP_MATLAB:
        case REQUEST_START_MATLAB:
            return true;
        case RECEIVE_SET_LICENSING:
        case RECEIVE_STOP_MATLAB:
        case RECEIVE_START_MATLAB:
        case RECEIVE_ERROR:
            return false;
        default:
            return state;
    }
}

export function fetchFailCount(state = 0, action) {
    switch (action.type) {
        case RECEIVE_SERVER_STATUS:
        case RECEIVE_SET_LICENSING:
        case RECEIVE_STOP_MATLAB:
        case RECEIVE_START_MATLAB:
            return 0;
        case RECEIVE_ERROR:
            return state + 1;
        default:
            return state;

    }
}

export function warnings(state = null, action) {
    switch (action.type) {
        case RECEIVE_SERVER_STATUS:
            const warnings = action.status.warnings;                             
            return warnings.length > 0
                ? warnings
                : null;
        default:
            return state;
    }
}

export function error(state = null, action) {
    switch (action.type) {
        case SET_AUTH_STATUS:
            if (action?.authentication?.error !== null) {
                const { message, type } = action.authentication.error;
                return {
                    message: message,
                    type: type,
                    logs: null
                };
            }
            else return null;
        case RECEIVE_ERROR:
            return {
                message: action.error,
                statusCode: action?.statusCode,
                logs: null
            };
        case RECEIVE_SERVER_STATUS:
        case RECEIVE_SET_LICENSING:
        case RECEIVE_STOP_MATLAB:
        case RECEIVE_START_MATLAB:
            return action.status.error
                ? {
                    message: action.status.error.message,
                    logs: action.status.error.logs,
                    type: action.status.error.type
                }
                : null;
        default:
            return state;
    }
}

export function envConfig(state = null, action) {
    switch (action.type) {
        case RECEIVE_ENV_CONFIG: {
            const { ...envConfig } = action.config;
            return envConfig;
        }
        default:
            return state;
    }
}

export const authentication = combineReducers({
    enabled: authEnabled,
    status: authStatus,
    token: authToken
});


export const matlab = combineReducers({
    versionOnPath : matlabVersionOnPath, 
});

export const serverStatus = combineReducers({
    licensingInfo,   
    wsEnv,
    isFetchingServerStatus,
    hasFetched,
    isSubmitting,
    fetchFailCount,
});


export default combineReducers({
    overlayVisibility,
    serverStatus,
    error,
    warnings,
    envConfig,
    matlab,
    authentication
});
