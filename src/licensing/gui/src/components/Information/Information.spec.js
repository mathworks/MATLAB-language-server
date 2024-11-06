// Copyright 2024 The MathWorks, Inc.

import React from 'react';
import Information from './index';
import App from '../App';
import { render } from '../../test/utils/react-test';
import { fireEvent } from '@testing-library/react';
import state from '../../test/utils/state';

const _ = require('lodash');

describe('Information Component', () => {
    let closeHandler, children, initialState;
    beforeEach(() => {
        children = (
            <div data-testid="child">
        Child1
            </div>
        );
        closeHandler = jest.fn().mockImplementation(() => { });

        initialState = _.cloneDeep(state);
        initialState.serverStatus.licensingInfo.entitlements = [initialState.serverStatus.licensingInfo.entitlements[0]];
        initialState.serverStatus.licensingInfo.entitlementId = initialState.serverStatus.licensingInfo.entitlements[0].id;

        const mockIntersectionObserver = jest.fn();
        mockIntersectionObserver.mockReturnValue({
            observe: () => null,
            disconnect: () => null
        });

        window.IntersectionObserver = mockIntersectionObserver;
    });
    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should throw console.error when rendered without closeHandler prop', () => {
        const errorMock = jest.spyOn(console, 'error').mockImplementation(() => { });

        render(<Information />);

        expect(errorMock).toHaveBeenCalledTimes(1);
    });

    it('should render without crashing', () => {
        render(<Information closeHandler={closeHandler} />);
    });

    it('should render child nodes passed to it without crashing', () => {
        const { getByTestId } = render(
            <Information closeHandler={closeHandler}>{children}</Information>
        );

        expect(getByTestId('child')).toBeInTheDocument();
    });

    it('should render Online Licensing info with licensing type MHLM', () => {
        const { getByText } = render(
            <Information closeHandler={closeHandler}>{children}</Information>,
            { initialState }
        );

        const licensingInfo = getByText('Licensing:');

        expect(licensingInfo.nextSibling.textContent).toContain(
            initialState.serverStatus.licensingInfo.emailAddress
        );
    });

    it('should render Online Licensing info with licensing type NLM', () => {
        initialState.serverStatus.licensingInfo = {
            type: 'nlm',
            connectionString: 'abc@nlm'
        };
        const { getByText } = render(
            <Information closeHandler={closeHandler} >{children}</Information>,
            { initialState }
        );

        const licensingInfo = getByText('Licensing:');

        expect(licensingInfo.nextSibling.textContent).toContain(
            initialState.serverStatus.licensingInfo.connectionString
        );
    });

    it('should render Existing License with licensing type existing_license', () => {
        initialState.serverStatus.licensingInfo = {
            type: 'existing_license'
        };
        const { getByText } = render(
            <Information closeHandler={closeHandler}>{children}</Information>,
            { initialState }
        );

        const licensingInfo = getByText('Licensing:');
        expect(licensingInfo.nextSibling.textContent).toEqual('Existing License');
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
            <Information closeHandler={closeHandler}>{children}</Information>,
            { initialState }
        );

        const errorContent = container.getElementsByClassName('error-msg').item(0)
            .textContent;

        expect(errorContent).toEqual(initialState.error.logs.join('\n').trim());
    });

    it('should close overlay on button click', () => {
        const { container } = render(
            <Information closeHandler={closeHandler}>{children}</Information>,
            { initialState }
        );

        const closeBtn = container.getElementsByClassName('close').item(0);

        fireEvent.click(closeBtn);
    });

    it('should close the Information Component and display the overlayTrigger when close button is clicked', () => {
    // Hide the tutorial and make the overlay visible.
        initialState.tutorialHidden = true;
        initialState.overlayVisibility = true;
        initialState.authentication.enabled = true;
        initialState.authentication.status = true;

        // Rendering the App component with the above changes to the initial
        // state should render the Information Component.
        const { getByTestId, container } = render(<App />, {
            initialState
        });

        const informationComponent = container.querySelector('#information');

        // Check if information dialog is displayed
        expect(informationComponent).toBeInTheDocument();

        // grab and click on the close button of information dialog
        const closeBtn = container.getElementsByClassName('close').item(0);
        fireEvent.click(closeBtn);

        const overlayTriggerComponent = getByTestId('overlayTrigger');

        // Check if information dialog is not displayed and overlay trigger is displayed.
        expect(informationComponent).not.toBeInTheDocument();
        expect(overlayTriggerComponent).toBeInTheDocument();
    });

    it('should call the closeHandler callback when the modal is clicked', () => {
        initialState.authentication.enabled = true;
        initialState.authentication.status = true;
        const { getByRole } = render(
            <Information closeHandler={closeHandler} >{children}</Information>,
            { initialState }
        );

        const modal = getByRole('dialog');
        fireEvent.click(modal);

        expect(closeHandler).toHaveBeenCalledTimes(1);
    });
});
