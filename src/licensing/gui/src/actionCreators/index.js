// Copyright 2024 The MathWorks, Inc.

import {
    SET_OVERLAY_VISIBILITY,
    REQUEST_SERVER_STATUS,
    RECEIVE_SERVER_STATUS,
    REQUEST_SET_LICENSING,
    REQUEST_UPDATE_LICENSING,
    REQUEST_ENV_CONFIG,
    RECEIVE_SET_LICENSING,
    RECEIVE_UPDATE_LICENSING,
    RECEIVE_ERROR,
    RECEIVE_ENV_CONFIG,
    SET_AUTH_STATUS,
    SET_AUTH_TOKEN,
} from '../actions';

import sha256 from 'crypto-js/sha256';
import { MWI_AUTH_TOKEN_NAME_FOR_HTTP } from '../constants';

export function setAuthStatus (authentication) {
    return {
        type: SET_AUTH_STATUS,
        authentication
    };
}

export function setAuthToken (authentication) {
    return {
        type: SET_AUTH_TOKEN,
        authentication
    };
}

export function setOverlayVisibility(visibility) {
    return {
        type: SET_OVERLAY_VISIBILITY,
        visibility
    };
}

export function requestServerStatus() {
    return {
        type: REQUEST_SERVER_STATUS,
    };
}

export function receiveServerStatus(status) {
    return function (dispatch) {
        return dispatch({
            type: RECEIVE_SERVER_STATUS,
            status,
        });
    };
}

export function requestEnvConfig() {
    return {
        type: REQUEST_ENV_CONFIG,
    };
}

export function receiveEnvConfig(config) {
    return {
        type: RECEIVE_ENV_CONFIG,
        config,
    };
}

export function requestSetLicensing() {
    return {
        type: REQUEST_SET_LICENSING,
    };
}

export function receiveSetLicensing(status) {
    return {
        type: RECEIVE_SET_LICENSING,
        status
    };
}

export function requestUpdateLicensing() {
    return {
        type: REQUEST_UPDATE_LICENSING,
    };
}

export function receiveUpdateLicensing(status) {
    return {
        type: RECEIVE_UPDATE_LICENSING,
        status
    };
}


export function receiveError(error, statusCode) {
    return {
        type: RECEIVE_ERROR,
        error,
        statusCode
    };
}

export async function fetchWithTimeout(dispatch, resource, options = {}, timeout = 10000) {
    // Create an abort controller for this request and set a timeout for it to abort.
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);

    try {
        const response = await fetch(resource, {
            ...options,
            signal: controller.signal
        });
        clearTimeout(id);

        return response;
    } catch (err) {
        const errorText = 'Check your internet connection and verify that the server is running.';
        // If AbortController is aborted, then AbortError exception is raised due to time out.
        if (err.name === 'AbortError' || err.name === 'TypeError') {
            dispatch(receiveError(`HTTP Error 408 - Request Timeout. ${errorText}`, 408));
        } else {
            dispatch(receiveError('Communication with server failed.', 500));
        }
    }
}

export function fetchServerStatus() {
    return async function (dispatch) {        
        dispatch(requestServerStatus());

        const url = './get_status';

        const response = await fetchWithTimeout(dispatch, url, {}, 10000);
        
        const data = await response.json();
        dispatch(receiveServerStatus(data));
    };
}

export function updateAuthStatus (token) {
    return async function (dispatch) {
        const tokenHash = sha256(token);
        const options = {
            method: 'POST',
            headers: {
                [MWI_AUTH_TOKEN_NAME_FOR_HTTP]: tokenHash
            }
        };
        const response = await fetchWithTimeout(dispatch, './authenticate', options, 15000);
        const data = await response.json();

        dispatch(setAuthStatus(data));
    };
}

export function getAuthToken () {
    return async function (dispatch) {
        const options = {
            method: 'GET'
        };
        const response = await fetchWithTimeout(dispatch, './get_auth_token', options, 10000);
        const data = await response.json();
        dispatch(setAuthToken(data));
    };
}

export function fetchEnvConfig() {
    return async function (dispatch) {

        dispatch(requestEnvConfig());
        const response = await fetchWithTimeout(dispatch, './get_env_config', {}, 10000);
        const data = await response.json();
        dispatch(receiveEnvConfig(data));
    };
}

export function fetchSetLicensing(info) {
    return async function (dispatch) {

        const options = {
            method: 'PUT',
            mode: 'same-origin',
            cache: 'no-cache',
            credentials: 'same-origin',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(info),
        };

        dispatch(requestSetLicensing());
        const response = await fetchWithTimeout(dispatch, './set_licensing_info', options, 15000);
        const data = await response.json();
        dispatch(receiveSetLicensing(data));

    };
}

export function fetchUpdateLicensing(info) {
    return async function (dispatch) {

        const options = {
            method: 'PUT',
            mode: 'same-origin',
            cache: 'no-cache',
            credentials: 'same-origin',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(info),
        };

        dispatch(requestUpdateLicensing());
        const response = await fetchWithTimeout(dispatch, './update_entitlement', options, 1500);
        const data = await response.json();
        dispatch(receiveUpdateLicensing(data));
    };
}

export function fetchUnsetLicensing() {
    return async function (dispatch) {

        const options = {
            method: 'DELETE',
            mode: 'same-origin',
            cache: 'no-cache',
            credentials: 'same-origin',
        };

        dispatch(requestSetLicensing());
        const response = await fetchWithTimeout(dispatch, './set_licensing_info', options, 15000);
        const data = await response.json();
        dispatch(receiveSetLicensing(data));

    };
}
