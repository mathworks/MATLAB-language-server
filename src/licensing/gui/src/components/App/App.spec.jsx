// Copyright 2020-2025 The MathWorks, Inc.

import React from 'react';
import { render } from '../../test/utils/react-test';
import App from './index';
import * as actionCreators from '../../actionCreators';
import state from '../../test/utils/state';
import { MWI_AUTH_TOKEN_NAME_FOR_HTTP } from '../../constants';

import { vi } from 'vitest';

const _ = require('lodash');


describe('App Component', () => {
    let initialState;
    beforeEach(() => {
        initialState = _.cloneDeep(state);

        // As the tests are run in a NodeJS environment whereas the correct values for document.URL and window.location.href
        // are set by the browser, for tests, set the appropriate values for document.URL, window.location.href and window.location.origin
        // for the component to render without errors
        // Delete and redefine 'origin' and 'href' properties as they are read-only.
        delete window.location;
        window.location = {
            origin: '/',
            href: 'http://127.0.0.1/'
        };

        initialState.serverStatus.licensingInfo.entitlements = [{ id: '1234567', label: null, license_number: '7654321' }];
        initialState.serverStatus.licensingInfo.entitlementId = '1234567';
        // Set initial hasFetched to true to skip mocking the initial /get_status request
        initialState.serverStatus.hasFetched = true;

        const mockIntersectionObserver = vi.fn();
        mockIntersectionObserver.mockReturnValue({
            observe: () => null,
            disconnect: () => null
        });

        window.IntersectionObserver = mockIntersectionObserver;
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('renders app without crashing', () => {
        const { getByTestId } = render(<App />, {initialState});
        expect(getByTestId('app')).toBeInTheDocument();
    });
   
    it('should render LicensingGatherer component within the App component when no licensing is provided and user is authenticated', () => {
        // Set licensingInfo to empty object.
        initialState.overlayVisibility = true;
        initialState.serverStatus.licensingInfo = {};
        initialState.authentication.enabled = true;
        initialState.authentication.status = true;

        const { getByRole } = render(<App />, { initialState });

        const licensingGathererComponent = getByRole(
            'dialog', { description: 'licensing-dialog' });

        expect(licensingGathererComponent).toBeInTheDocument();
    });

    it('should render LicensingGatherer component within the App component when no licensing is provided and authentication is disabled', () => {
        // Set licensingInfo to empty object.
        initialState.overlayVisibility = true;
        initialState.serverStatus.licensingInfo = {};
        initialState.authentication.enabled = false;

        const { getByRole } = render(<App />, { initialState });

        const licensingGathererComponent = getByRole(
            'dialog', { description: 'licensing-dialog' });

        expect(licensingGathererComponent).toBeInTheDocument();
    });

    it('should display MatlabInstallError', () => {
        initialState.error = {
            type: 'MatlabInstallError',
            message: 'Matlab Installation error. Exited with status code -9'
        };
        initialState.serverStatus.licensingInfo = {};
        initialState.overlayVisibility = true;

        const { container } = render(<App />, {
            initialState
        });

        const paragraphElements = [...container.getElementsByTagName('pre')];

        expect(
            paragraphElements.some((p) =>
                p.textContent.includes(initialState.error.message)
            )
        ).toBe(true);
    });

    const tokenInQuery = '12345';
    it.each([
        [`?${MWI_AUTH_TOKEN_NAME_FOR_HTTP}=${tokenInQuery}&test1=1&test2=2`, tokenInQuery],
        [`?test1=1&${MWI_AUTH_TOKEN_NAME_FOR_HTTP}=${tokenInQuery}&test2=2`, tokenInQuery],
        [`?test1=1&test2=2&${MWI_AUTH_TOKEN_NAME_FOR_HTTP}=${tokenInQuery}`, tokenInQuery]
    ])('should pick the token correctly when the query parameters are \'%s\'', (queryParams, expectedToken) => {
        const url = 'http://localhost.com:5555';
        const mockUpdateAuthStatus = vi.spyOn(actionCreators, 'updateAuthStatus').mockImplementation(() => {
            return () => Promise.resolve();
        });
        window.location = {
            origin: '/',
            href: url,
            search: queryParams
        };
        render(<App />, { initialState });
        expect(mockUpdateAuthStatus).toHaveBeenCalledWith(expectedToken);
        mockUpdateAuthStatus.mockRestore();
    });
});
