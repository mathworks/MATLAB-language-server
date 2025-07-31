// Copyright 2020-2025 The MathWorks, Inc.

import React from 'react';
import EntitlementSelector, { filterAndFormatEntitlements, defaultLicenseUnavailableMsg } from './index';
import App from '../App';
import { render } from '../../test/utils/react-test';
import { fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import state from '../../test/utils/state';
import * as actionCreators from '../../actionCreators';


const _ = require('lodash');

describe('EntitlementSelector Component', () => {
    let initialState;

    beforeEach(() => {
        initialState = _.cloneDeep(state);
    });

    const options = [
        { id: 'entitlement1', label: 'label1', license_number: 'license1' },
        { id: 'entitlement2', label: 'label2', license_number: 'license2' },
        { id: 'entitlement3', label: 'label3', license_number: 'license3' },
        { id: 'entitlement4', label: 'label4', license_number: null },
        { id: 'entitlement5', label: 'label5', license_number: '' },
        { id: 'entitlement6', label: null, license_number: 'license6' },
        { id: 'entitlement7', label: '', license_number: 'license7' }
    ];

    function setup (jsx) {
        return {
            user: userEvent.setup(),
            ...render(jsx)
        };
    }

    it('should render correctly', () => {
        render(<EntitlementSelector options={options} />);
    });

    it('should render with default value selected and all options present', () => {
        const { getByRole } = render(<EntitlementSelector options={options} />);

        const comboBox = getByRole('combobox');
        expect(comboBox.length).toBeGreaterThanOrEqual(3);
        expect(comboBox).toHaveValue('entitlement1');
        expect(getByRole('option', { name: 'license1 - label1' }).selected).toBe(true);
    });

    it('should select correct value on change', async () => {
        const { user, getByRole } = setup(
            <EntitlementSelector options={options} />
        );
        const comboBox = getByRole('combobox');
        await user.selectOptions(comboBox, 'entitlement2');
        expect(comboBox).toHaveValue('entitlement2');
    });

    it('should fire onClick Event for submit button without crashing', () => {
        const mockFetchServerStatus = vi.spyOn(actionCreators, 'fetchServerStatus').mockImplementation(() => {
            return () => Promise.resolve();
        });
        const mockFetchEnvConfig = vi.spyOn(actionCreators, 'fetchEnvConfig').mockImplementation(() => {
            return () => Promise.resolve();
        });
        const mockFetchUpdateLicensing = vi.spyOn(actionCreators, 'fetchUpdateLicensing').mockImplementation(() => {
            return () => Promise.resolve();
        });

        const { getByTestId, container, unmount } = render(<App />, {
            initialState
        });

        // Expecting the license selector dialog since entitlementId is not set
        expect(
            container.querySelector('#entitlement-selection')
        ).toBeInTheDocument();
        const submitButton = getByTestId('submitButton');
        fireEvent.click(submitButton);

        // re-rendering (via unmount and rendering again similar to real app) so
        // that the redux state (entitlementId) is updated for test App component
        unmount();
        render(<App />);
        expect(
            container.querySelector('#entitlement-selection')
        ).not.toBeInTheDocument();
        
        mockFetchServerStatus.mockRestore();            
        mockFetchEnvConfig.mockRestore(); 
        mockFetchUpdateLicensing.mockRestore();           
    });

    it('should filter and format entitlements correctly', async () => {
        const formattedEntitlements = filterAndFormatEntitlements(options);

        expect(formattedEntitlements).toEqual([
            { label: 'license1 - label1', value: 'entitlement1' },
            { label: 'license2 - label2', value: 'entitlement2' },
            { label: 'license3 - label3', value: 'entitlement3' },
            { label: `license6 - ${defaultLicenseUnavailableMsg}`, value: 'entitlement6' },
            { label: `license7 - ${defaultLicenseUnavailableMsg}`, value: 'entitlement7' }
        ]);
    });
});
