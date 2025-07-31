// Copyright 2024 The MathWorks, Inc.

import * as selectors from './index';
import state from '../test/utils/state';
import { STATUS_REQUEST_INTERVAL_MS, MAX_REQUEST_FAIL_COUNT } from '../constants';
const _ = require('lodash');

describe('selectors', () => {
    let modifiedState;

    const { 
        serverStatus,
        error,
        authentication,
    } = state;

    const {
        isSubmitting,
        hasFetched,
        licensingInfo,
        fetchFailCount,
        fetchAbortController,
    } = state.serverStatus;

    const {
        versionOnPath: matlabVersionOnPath
    } = state.matlab;

    const { 
        enabled: authEnabled,
        status: authStatus,
        token: authToken,
    } = authentication;

    const {
        selectServerStatus,
        selectError,
        selectMatlabVersionOnPath,
        selectSubmittingServerStatus,
        selectHasFetchedServerStatus,
        selectLicensingInfo,
        selectServerStatusFetchFailCount,
        selectAuthEnabled,
        selectIsAuthenticated,
        selectAuthToken,
        selectIsError,
        selectIsConnectionError,
        selectOverlayVisibility,
        getFetchAbortController,
        selectFetchStatusPeriod,
        selectLicensingProvided,
        selectLicensingIsMhlm,
        selectLicensingMhlmUsername,
        selectOverlayVisible,
        selectInformationDetails,
    } = selectors;

    describe.each([
        [selectServerStatus, serverStatus],
        [selectError, error],
        [selectMatlabVersionOnPath, matlabVersionOnPath],
        [selectSubmittingServerStatus, isSubmitting],
        [selectHasFetchedServerStatus, hasFetched],
        [selectLicensingInfo, licensingInfo],
        [selectServerStatusFetchFailCount, fetchFailCount],
        [selectAuthEnabled, authEnabled],
        [selectIsAuthenticated, authStatus],
        [selectAuthToken, authToken],
        [getFetchAbortController, fetchAbortController]
    ])
    ('Test simple selectors',
        (selector, expected) => {
            test(`Check if ${selector.name} selects piece of state`, () => {
                expect(selector(state)).toBe(expected);
            });
        }
    );

    describe('Test derived selectors', () => {      
        test('selectIsError should return false when no error', () => {
            expect(selectIsError(state)).toBe(false);
        });

        test('selectIsError should return true when  error', () => {
            modifiedState = _.cloneDeep(state);
            modifiedState.error = {};

            expect(selectIsError(modifiedState)).toBe(true);
        });

        test(`selectIsConnectionError should return false when fetch fail count is less than ${MAX_REQUEST_FAIL_COUNT}`, () => {
            expect(selectIsConnectionError(state)).toBe(false);
        });

        test(`selectIsConnectionError should return true when fetch fail count exceeds or becomes equal to ${MAX_REQUEST_FAIL_COUNT}`, () => {

            modifiedState = _.cloneDeep(state);
            modifiedState.serverStatus.fetchFailCount = MAX_REQUEST_FAIL_COUNT;
            expect(selectIsConnectionError(modifiedState)).toBe(true);
        });

        test('selectFetchStatusPeriod should return null if submitting to server', () => {
            expect(selectFetchStatusPeriod(state)).toBeNull();
        });

        test('selectFetchStatusPeriod should return null if the server is fetching any kind server status', () => {
            modifiedState = _.cloneDeep(state);
            modifiedState.serverStatus.isFetchingServerStatus = true;
            expect(selectFetchStatusPeriod(modifiedState)).toBeNull();
        });

        test('selectLicensingProvided should return true if licensingInfo has property type else false', () => {
            expect(selectLicensingProvided(state)).toBe(true);

            modifiedState = _.cloneDeep(state);
            delete modifiedState.serverStatus.licensingInfo.type;

            expect(selectLicensingProvided(modifiedState)).toBe(false);
        });

        test('selectLicensingIsMhlm should return true is licensing is of type MHLM', () => {
            expect(selectLicensingIsMhlm(state)).toBe(true);
        });


        test('selectLicensingIsMhlm should return false is licensing is not of type MHLM', () => {
            modifiedState = _.cloneDeep(state);
            delete modifiedState.serverStatus.licensingInfo.type;
            expect(selectLicensingIsMhlm(modifiedState)).toBe(false);

            modifiedState = _.cloneDeep(state);
            modifiedState.serverStatus.licensingInfo.type = 'NLM';
            expect(selectLicensingIsMhlm(modifiedState)).toBe(false);
        });


        test('selectLicensingMhlmUsername should return the email address if licensing is of type MHLM', () => {
            expect(selectLicensingMhlmUsername(state)).toBe(state.serverStatus.licensingInfo.emailAddress);
        });


        test('selectLicensingMhlmUsername should return empty string if licensing is not of type MHLM', () => {
            modifiedState = _.cloneDeep(state);
            modifiedState.serverStatus.licensingInfo.type = 'NLM';
            expect(selectLicensingMhlmUsername(modifiedState)).toBe('');
        });

        test('selectOverlayVisible should return true if selectOverlayVisibility is true or if there is any error', () => {
            // When overlay is visible and no error
            expect(selectOverlayVisible(state)).toBe(true);

            modifiedState = _.cloneDeep(state);
            modifiedState.overlayVisibility = false;
            modifiedState.error = {};

            // when overlay is not visible and error is not null
            expect(selectOverlayVisibility(modifiedState)).toBe(true);

            modifiedState = _.cloneDeep(state);
            modifiedState.error = {};
            // when overlay is visible and there is an error
            expect(selectOverlayVisibility(modifiedState)).toBe(true);

        });

        test('selectOverlayVisible should return false if selectOverlayVisibility is false and if there is no error', () => {
            modifiedState = _.cloneDeep(state);
            modifiedState.overlayVisibility = false;
        });

        test('When backend is not reachable, selectInformationDetails should return object with icon warning and label unknown', () => {
            modifiedState = _.cloneDeep(state);
            modifiedState.error = { message: 'HTTP request timed out', statusCode: 408 };

            expect(selectInformationDetails(modifiedState).icon.toLowerCase()).toContain('warning');
            expect(selectInformationDetails(modifiedState).label.toLowerCase()).toContain('unknown');
        });
    });
});
