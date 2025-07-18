// Copyright 2024 The MathWorks, Inc.

import * as reducers from './index';
import * as actions from '../actions';

const _ = require('lodash');

describe('reducers', () => {
    let genericAction, action;
    const receiveActions = [],
        requestActions = [];

    beforeAll(() => {
        genericAction = {
            type: '',
            error: 'Licensing Error',
            loadUrl: '/',
            hidden: true,
            x: 12,
            y: 12,
            previousMatlabPending: true,
            status: {
                wsEnv: 'mw-integ',
                matlab: {
                    status: 'up',
                    version: 'R2020b',
                },
                licensing: {
                    type: 'MHLM',
                },
            },
            authentication: {
                enabled: false,
                status: false,
                token: null,
            }
        };

        receiveActions.push(
            actions.RECEIVE_SERVER_STATUS,
            actions.RECEIVE_SET_LICENSING,
            actions.RECEIVE_STOP_MATLAB,
            actions.RECEIVE_START_MATLAB
        );

        requestActions.push(
            actions.REQUEST_SERVER_STATUS,
            actions.REQUEST_SET_LICENSING,
            actions.REQUEST_STOP_MATLAB,
            actions.REQUEST_START_MATLAB
        );
    });

    describe('overlayVisibility', () => {
        it('should return the intial state', () => {
            expect(reducers.overlayVisibility(undefined, genericAction)).toEqual(true);
        });

        it('should handle SET_OVERLAY_VISIBILITY', () => {
            // Set visibility to true
            action = _.cloneDeep(genericAction);
            action.type = actions.SET_OVERLAY_VISIBILITY;
            action.visibility = true;
            expect(reducers.overlayVisibility(undefined, action)).toBe(true);

            // set visibility to false
            action = _.cloneDeep(genericAction);
            action.type = actions.SET_OVERLAY_VISIBILITY;
            action.visibility = false;
            expect(reducers.overlayVisibility(undefined, action)).toBe(false);
        });

        it('should handle RECEIVE_SERVER_STATUS', () => {

            action = _.cloneDeep(genericAction);
            action.type = actions.RECEIVE_SERVER_STATUS;

            expect(reducers.overlayVisibility(undefined, action)).toBe(true);
        });

        it('should return current state when unknown action.type', () => {

            action = _.cloneDeep(genericAction);
            action.type = actions.RECEIVE_SET_LICENSING;

            expect(reducers.overlayVisibility(false, action)).toBe(false);
            expect(reducers.overlayVisibility(true, action)).toBe(true);
        });
    });

    describe('authEnabled', () => {
        it('should return whether token authenticaton is enabled', () => {
     
            // default case
            action = _.cloneDeep(genericAction);
            expect(reducers.authEnabled(true, action)).toBe(true);
            expect(reducers.authEnabled(false, action)).toBe(false);
      
            // expect authEnabled to be false
            action = _.cloneDeep(genericAction);
            action.type = actions.RECEIVE_ENV_CONFIG;
            action.config = {
                authentication : {
                    enabled: false
                }
            };
            expect(reducers.authEnabled(undefined, action)).toBe(false);


            // expect authEnabled to be true      
            action = _.cloneDeep(genericAction);
            action.config = {
                authentication : {
                    enabled: true
                }
            };
            action.type = actions.RECEIVE_ENV_CONFIG;
            expect(reducers.authEnabled(undefined, action)).toBe(true);
        });
    });

    describe('authStatus', () => {
        it('should return whether the user/client is authorised', () =>{
      
            // expect authStatus to be false
            action = _.cloneDeep(genericAction);
            action.type = actions.SET_AUTH_STATUS;
            action.authentication = {status: false};
            expect(reducers.authStatus(undefined, action)).toBe(false);

            // expect authStatus to be true
            action = _.cloneDeep(genericAction);
            action.type = actions.SET_AUTH_STATUS;
            action.authentication = {status: true};
      
            expect(reducers.authStatus(undefined, action)).toBe(true);

            // default case
            action = _.cloneDeep(genericAction);
            expect(reducers.authStatus(true, action)).toBe(true);
            expect(reducers.authStatus(false, action)).toBe(false);
      
        });
    });

    describe('authToken', () => {
        it('should return the value of the auth token', () =>{
      
            // expect authToken to be null
            action = _.cloneDeep(genericAction);
            action.type = actions.SET_AUTH_TOKEN;
            expect(reducers.authToken(undefined, action)).toBeNull();

            // expect authToken to be a string
            action = _.cloneDeep(genericAction);
            action.type = actions.SET_AUTH_TOKEN;
            action.authentication.token = 'string';
            expect(reducers.authToken(undefined, action)).toBe('string');

            // default case
            action = _.cloneDeep(genericAction);
            expect(reducers.authToken(null, action)).toBeNull();
            expect(reducers.authToken('string', action)).toBe('string');
      
        });
    });

    describe('licensingInfo', () => {
        it('should return licensing info for actions defined in receiveActions array', () => {
            for (let i = 0; i < receiveActions.length; i++) {
                action = _.cloneDeep(genericAction);
                action.type = receiveActions[i];
                expect(reducers.licensingInfo(undefined, action)).toMatchObject(
                    action.status.licensing
                );
            }
        });

        it('should return empty object as default state', () => {
            action = _.cloneDeep(genericAction);
            const state = reducers.licensingInfo(undefined, action);
            expect(typeof state).toBe('object');
        });
    });

    describe('wsEnv', () => {
        it('should return wsEnv value for action type defined in receiveActions', () => {
            for (let i = 0; i < receiveActions.length; i++) {
                action = _.cloneDeep(genericAction);
                action.type = receiveActions[i];
                expect(reducers.wsEnv(undefined, action)).toBe(
                    action.status.wsEnv
                );
            }
        });

        it('should return null by default', () => {
            action = _.cloneDeep(genericAction);
            action.type = actions.REQUEST_SERVER_STATUS;
            expect(reducers.wsEnv(undefined, action)).toBeNull();
        });
    });

    describe('isFetching', () => {
        it('should return True for actions in requestActions and False for receiveActions', () => {
            for (let i = 0; i < requestActions.length; i++) {
                action = _.cloneDeep(genericAction);
                action.type = requestActions[i];
                expect(reducers.isFetching(undefined, action)).toBe(true);


                action = _.cloneDeep(genericAction);
                action.type = receiveActions[i];
                expect(reducers.isFetching(undefined, action)).toBe(false);
            }
        });

        it('should return false for RECEIVE_ERROR', () => {
            action = _.cloneDeep(genericAction);
            action.type = actions.RECEIVE_ERROR;
            expect(reducers.isFetching(undefined, action)).toBe(false);
        });

        it('Check default case', () => {
            action = _.cloneDeep(genericAction);
            expect(reducers.isFetching(false, action)).toBe(false);
            expect(reducers.isFetching(true, action)).toBe(true);
        });
    });

    describe('hasFetched', () => {
        it('should return true for actions defined in receiveActions', () => {
            for (let i = 0; i < receiveActions.length; i++) {
                action = _.cloneDeep(genericAction);
                action.type = receiveActions[i];
                expect(reducers.hasFetched(undefined, action)).toBe(true);
            }
        });

        it('Check default case', () => {
            action = _.cloneDeep(genericAction);
            expect(reducers.hasFetched(undefined, action)).toBe(false);
            expect(reducers.hasFetched(true, action)).toBe(true);
        });
    });

    describe('isSubmitting', () => {
        it('should return true for action types in requestActions except REQUEST_SERVER_STATUS and false for action types in receiveActions', () => {
            for (let i = 0; i < requestActions.length; i++) {

                action = _.cloneDeep(genericAction);
                action.type = requestActions[i];

                // expect to be true for request action type
                if (action.type !== actions.REQUEST_SERVER_STATUS) {
                    expect(reducers.isSubmitting(undefined, action)).toBe(true);
                }

                // expect to be false for receive action type
                action = _.cloneDeep(genericAction);
                action.type = receiveActions[i];
                expect(reducers.isSubmitting(undefined, action)).toBe(false);
            }
        });

        it('Check default case', () => {
            action = _.cloneDeep(genericAction);
            expect(reducers.isSubmitting(undefined, action)).toBe(false);
            expect(reducers.isSubmitting(true, action)).toBe(true);
        });
    });

    describe('fetchFailCount', () => {
        it('should maintain state value at 0 for action types in receiveActions', () => {
            for (let i = 0; i < receiveActions.length; i++) {
                action = _.cloneDeep(genericAction);
                action.type = receiveActions[i];
                expect(reducers.fetchFailCount(0, action)).toEqual(0);
            }
        });

        // For action type : RECEIVE_ERROR increment failcount.
        it('should increment state value when action type : RECEIVE_ERROR', () => {
            action = _.cloneDeep(genericAction);
            action.type = actions.RECEIVE_ERROR;
            let state = 0;
            expect(reducers.fetchFailCount(state, action)).toEqual(state + 1);
            state = 3;
            expect(reducers.fetchFailCount(state, action)).toEqual(state + 1);
        });

        it('should maintain the same state value in default case', () => {
            action = _.cloneDeep(genericAction);
            expect(reducers.fetchFailCount(1, action)).toEqual(1);
        });
    });

    describe('error', () => {
        it('should return an object with message and logs as properties', () => {
            action = _.cloneDeep(genericAction);
            action.type = actions.RECEIVE_ERROR;
            expect(reducers.error(undefined, action)).toMatchObject({
                message: action.error,
                logs: null,
            });
        });

        const statusError = {
            message: 'Matlab exited with exit code 9',
            logs: 'Java AWT error',
            type: 'java.awt.headlessexception',
        };

        it('should return an error object containing (message, logs and type of error) if there is an error else return null', () => {
            for (let i = 0; i < receiveActions.length; i++) {
                action = _.cloneDeep(genericAction);
                action.type = receiveActions[i];
                action.status.error = null;
                expect(reducers.error(undefined, action)).toBeNull();

                action = _.cloneDeep(genericAction);

                action.type = receiveActions[i];
                action.status.error = statusError;
                expect(reducers.error(undefined, action)).toMatchObject({
                    message: action.status.error.message,
                    logs: action.status.error.logs,
                    type: action.status.error.type,
                });
            }
        });

        it('should return default state', () => {
            action = _.cloneDeep(genericAction);
            expect(reducers.error(undefined, action)).toBeNull();
        });
    });
});
