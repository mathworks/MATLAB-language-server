// Copyright 2020-2025 The MathWorks, Inc.

import React from 'react';
import Information from './index';
import { render } from '../../test/utils/react-test';
import { fireEvent } from '@testing-library/react';
import state from '../../test/utils/state';

const _ = require('lodash');

describe('Information Component', () => {
    let initialState;
    beforeEach(() => { 
        initialState = _.cloneDeep(state);
        initialState.serverStatus.licensingInfo.entitlements = [initialState.serverStatus.licensingInfo.entitlements[0]];
        initialState.serverStatus.licensingInfo.entitlementId = initialState.serverStatus.licensingInfo.entitlements[0].id;

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

    it('should render without crashing', () => {
        render(<Information />);
    });



    it('should display errors', () => {
        initialState.error = {
            message: 'Exited with exit code -9',
            logs: [
                'Matlab exited with exit code -9',
                'Check matlab logs for more details'
            ]
        };

        const { container } = render(
            <Information ></Information>,
            { initialState }
        );

        const errorContent = container.getElementsByClassName('error-msg').item(0)
            .textContent;

        expect(errorContent).toEqual(initialState.error.logs.join('\n').trim());
    });

    it('should close overlay on button click', () => {
        const { container } = render(
            <Information></Information>,
            { initialState }
        );

        const closeBtn = container.getElementsByClassName('close').item(0);

        fireEvent.click(closeBtn);
    });
});
