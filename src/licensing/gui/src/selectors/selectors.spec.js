// Copyright 2024 The MathWorks, Inc.

import * as selectors from './index';
import state from '../test/utils/state';
import { STATUS_REQUEST_INTERVAL_MS, MAX_REQUEST_FAIL_COUNT } from '../constants';
const _ = require('lodash');

describe('selectors', () => {
  let modifiedState;

  const { 
    tutorialHidden,
    serverStatus,
    loadUrl,
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
    status: matlabStatus, 
    versionOnPath: matlabVersionOnPath
  } = state.matlab

  const { 
    enabled: authEnabled,
    status: authStatus,
    token: authToken,
  } = authentication;

  const {
    selectTutorialHidden,
    selectServerStatus,
    selectLoadUrl,
    selectError,
    selectMatlabStatus,
    selectMatlabVersionOnPath,
    selectSubmittingServerStatus,
    selectHasFetchedServerStatus,
    selectLicensingInfo,
    selectServerStatusFetchFailCount,
    selectAuthEnabled,
    selectIsAuthenticated,
    selectAuthToken,
    selectIsActiveClient,
    selectTriggerPosition,
    selectIsError,
    selectIsConnectionError,
    selectMatlabUp,
    selectOverlayHidable,
    selectOverlayVisibility,
    getFetchAbortController,
    selectFetchStatusPeriod,
    selectLicensingProvided,
    selectLicensingIsMhlm,
    selectLicensingMhlmUsername,
    selectMatlabPending,
    selectOverlayVisible,
    selectInformationDetails,
    selectIsConcurrent,
  } = selectors;

  describe.each([
    [selectTutorialHidden, tutorialHidden],
    [selectServerStatus, serverStatus],
    [selectLoadUrl, loadUrl],
    [selectError, error],
    [selectMatlabStatus, matlabStatus],
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
    test('selectTriggerPosition return position for valid trigger position', () => {
      expect(selectTriggerPosition(state)).toEqual(state.triggerPosition);

      modifiedState = _.cloneDeep(state);
      modifiedState.triggerPosition = null;

      expect(selectTriggerPosition(modifiedState)).toBeUndefined();
    });

    test('selectTriggerPosition return undefined for invalid trigger position', () => {
      modifiedState = _.cloneDeep(state);
      modifiedState.triggerPosition = null;

      expect(selectTriggerPosition(modifiedState)).toBeUndefined();
    });

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

    test('selectIsConnectionError should return true when fetch request fails even once if the current session is a concurrent session', () => {
      modifiedState = _.cloneDeep(state);
      modifiedState.sessionStatus.isActiveClient = false;
      modifiedState.sessionStatus.isConcurrencyEnabled = true;
      modifiedState.serverStatus.fetchFailCount = 1;
      expect(selectIsConnectionError(modifiedState)).toBe(true);
    });

    test('selectIsConcurrent should return false when the Client is the active client', () => {
      expect(selectIsConcurrent(state)).toBe(false);
    });

    test('selectIsConcurrent should return true when the Client is no longer the active client',() => {
      modifiedState = _.cloneDeep(state);
      modifiedState.sessionStatus.isActiveClient = false;
      expect(selectIsConcurrent(modifiedState)).toBe(true);
    });

    test('selectMatlabUp should return true when Matlab is up', () => {
      expect(selectMatlabUp(state)).toBe(true);
    });

    test('selectMatlabUp should false when Matlab status is not up', () => {

      modifiedState = _.cloneDeep(state);
      modifiedState.matlab.status = 'down';
      expect(selectMatlabUp(modifiedState)).toBe(false);
    });


    test('selectMatlabUp should return true when Matlab is up', () => {
      expect(selectMatlabUp(state)).toBe(true);
      modifiedState = _.cloneDeep(state);
      modifiedState.matlab.status = 'starting';
      expect(selectMatlabUp(modifiedState)).toBe(false);
    });

    test('selectMatlabUp should false when Matlab status is not up', () => {
      modifiedState = _.cloneDeep(state);
      modifiedState.matlab.status = 'down';
      expect(selectMatlabUp(modifiedState)).toBe(false);
    });

    test('selectMatlabStopping should true when Matlab status is stopping', () => {
      modifiedState = _.cloneDeep(state);
      modifiedState.matlab.status = 'stopping';
      expect(selectors.selectMatlabStopping(modifiedState)).toBe(true);
    });

    test('selectMatlabStopping should false when Matlab status is not stopping', () => {
      modifiedState = _.cloneDeep(state);
      modifiedState.matlab.status = 'up';
      expect(selectors.selectMatlabStopping(modifiedState)).toBe(false);
    });

    test('selectMatlabStarting should true when Matlab status is starting', () => {
      modifiedState = _.cloneDeep(state);
      modifiedState.matlab.status = 'starting';
      expect(selectors.selectMatlabStarting(modifiedState)).toBe(true);
    });

    test('selectMatlabStarting should false when Matlab status is not starting', () => {
      modifiedState = _.cloneDeep(state);
      modifiedState.matlab.status = 'up';
      expect(selectors.selectMatlabStopping(modifiedState)).toBe(false);
    });

    test('selectOverlayHidable should return true when matlab is up and there is no error and user is authenticated or auth is not enabled', () => {
      modifiedState = _.cloneDeep(state);
      modifiedState.authentication.enabled = true;
      modifiedState.authentication.status =  true;
      expect(selectOverlayHidable(modifiedState)).toBe(true);

      modifiedState = _.cloneDeep(state);
      modifiedState.authentication.enabled = false;
      expect(selectOverlayHidable(modifiedState)).toBe(true);
    });

    test('selectOverlayHidable should return false when matlab is not up or there is an error or the user is not authenticated', () => {
      modifiedState = _.cloneDeep(state);
      modifiedState.matlab.status = 'down';
      expect(selectOverlayHidable(modifiedState)).toBe(false);

      modifiedState = _.cloneDeep(state);
      modifiedState.error = {};
      expect(selectOverlayHidable(modifiedState)).toBe(false);

      modifiedState = _.cloneDeep(state);
      modifiedState.authentication.enabled = true;
      modifiedState.authentication.status =  false;
      expect(selectOverlayHidable(modifiedState)).toBe(false);
    });


    test('selectOverlayVisibility should return true when matlab is not up or visibility is true or there is an error or the user is not authenticated', () => {
      //Should return true based on state.overlayVisibility
      expect(selectOverlayVisibility(state)).toBe(true);

      //should return true based on matlabStatus
      modifiedState = _.cloneDeep(state);
      modifiedState.matlab.status = 'down';
      modifiedState.overlayVisibility = false;
      expect(selectOverlayVisibility(modifiedState)).toBe(true);

      //should return true based on error
      modifiedState = _.cloneDeep(state);
      modifiedState.matlab.status = 'down';
      modifiedState.overlayVisibility = false;
      modifiedState.error = {};
      expect(selectOverlayVisibility(modifiedState)).toBe(true);

      modifiedState = _.cloneDeep(state);
      modifiedState.overlayVisibility = false;
      modifiedState.authentication.enabled = true;
      modifiedState.authentication.status =  false;
      expect(selectOverlayVisibility(modifiedState)).toBe(true);
    });

    test('selectOverlayVisibility should return false when matlab is up and visibility is false and there is no error and user is authenticated if auth is enabled', () => {
      //Should return false matlab is up and overlayVisibility is false and there is an error
      modifiedState = _.cloneDeep(state);
      modifiedState.overlayVisibility = false;
      expect(selectOverlayVisibility(modifiedState)).toBe(false);

      modifiedState = _.cloneDeep(state);
      modifiedState.overlayVisibility = false;
      modifiedState.authentication.enabled = true;
      modifiedState.authentication.status =  true;
      expect(selectOverlayVisibility(modifiedState)).toBe(false);
    });

    test('selectFetchStatusPeriod should return null if submitting to server', () => {
      expect(selectFetchStatusPeriod(state)).toBeNull();
    });

    test('selectFetchStatusPeriod should return null if the server is fetching any kind server status', () => {
      modifiedState = _.cloneDeep(state);
      modifiedState.serverStatus.isFetchingServerStatus = true;
      expect(selectFetchStatusPeriod(modifiedState)).toBeNull();
    });

    test('selectFetchStatusPeriod should return null if concurrency check is enabled and there is a concurrent session', () => {
      modifiedState = _.cloneDeep(state);
      modifiedState.sessionStatus.isActiveClient = true;
      modifiedState.sessionStatus.isConcurrencyEnabled = true;
      expect(selectFetchStatusPeriod(modifiedState)).toBeNull();
    });

    test(`selectFetchStatusPeriod should return ${STATUS_REQUEST_INTERVAL_MS} when matlab is up `, () => {
      modifiedState = _.cloneDeep(state);
      modifiedState.serverStatus.isSubmitting = false;
      modifiedState.sessionStatus.isActiveClient = true;
      expect(selectFetchStatusPeriod(modifiedState)).toBe(STATUS_REQUEST_INTERVAL_MS);
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
      modifiedState.serverStatus.licensingInfo.type = "NLM";
      expect(selectLicensingIsMhlm(modifiedState)).toBe(false);
    });


    test('selectLicensingMhlmUsername should return the email address if licensing is of type MHLM', () => {
      expect(selectLicensingMhlmUsername(state)).toBe(state.serverStatus.licensingInfo.emailAddress)
    });


    test('selectLicensingMhlmUsername should return empty string if licensing is not of type MHLM', () => {
      modifiedState = _.cloneDeep(state);
      modifiedState.serverStatus.licensingInfo.type = 'NLM';
      expect(selectLicensingMhlmUsername(modifiedState)).toBe('');
    });

    test('selectMatlabPending should true if matlabStatus is starting, false otherwise ', () => {
      expect(selectMatlabPending(state)).toBe(false);

      modifiedState = _.cloneDeep(state);
      modifiedState.matlab.status = 'starting';
      expect(selectMatlabPending(modifiedState)).toBe(true);
    });

    test('selectOverlayVisible should return true if selectOverlayVisibility is true or if there is any error', () => {
      // When overlay is visible and no error
      expect(selectOverlayVisible(state)).toBe(true);

      modifiedState = _.cloneDeep(state);
      modifiedState.overlayVisibility = false;
      modifiedState.error = {}

      // when overlay is not visible and error is not null
      expect(selectOverlayVisibility(modifiedState)).toBe(true);

      modifiedState = _.cloneDeep(state);
      modifiedState.error = {}
      // when overlay is visible and there is an error
      expect(selectOverlayVisibility(modifiedState)).toBe(true);

    });

    test('selectOverlayVisible should return false if selectOverlayVisibility is false and if there is no error', () => {
      modifiedState = _.cloneDeep(state);
      modifiedState.overlayVisibility = false;
    });

    test('For any other MatlabStatus  selectInformationDetails should throw an error', () => {
      modifiedState = _.cloneDeep(state);
      modifiedState.matlab.status = 'defaultCase';

      expect(() => selectInformationDetails(modifiedState)).toThrow(Error);
    });

    test('For MatlabStatus down and with an error, selectInformationDetails should return object with icon error', () => {
      modifiedState = _.cloneDeep(state);
      // we are triggering the auth error by setting error to empty object here
      modifiedState.error = {};
      modifiedState.matlab.status = 'down';
      modifiedState.authentication.enabled = true;
      modifiedState.authentication.status = true;
      expect(selectInformationDetails(modifiedState).icon.toLowerCase()).toContain('error');
    });

    test('When backend is not reachable, selectInformationDetails should return object with icon warning and label unknown', () => {
      modifiedState = _.cloneDeep(state);
      modifiedState.error = { message: 'HTTP request timed out', statusCode: 408 };

      expect(selectInformationDetails(modifiedState).icon.toLowerCase()).toContain('warning');
      expect(selectInformationDetails(modifiedState).label.toLowerCase()).toContain('unknown');
    });

    describe.each([
      ['up', 'running'],
      ['starting', 'starting'],
      ['down', 'not running'],
    ])(
      'SelectInformationDetails',
      (input, expected) => {

        beforeAll(() => {
          modifiedState = _.cloneDeep(state);
          modifiedState.matlab.status = input;
        });
        test(`For MatlabStatus ${input}, selectInformationDetails should return object with label which contains: ${expected}`, () => {
          expect(selectInformationDetails(modifiedState).label.toLowerCase()).toContain(expected);
        });
      }
    );
  });
});
