// Copyright 2020-2025 The MathWorks, Inc.

import React from 'react';
import Error from './index';
import { render } from '../../test/utils/react-test';

describe('Error Component', () => {
    const message = 'Matlab Failed unexpectedly';
    const logs = ['Check Matlab Path', 'Check Matlab Version'];

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('throws console.error when rendered without message prop type', () => {
        const errorMock = vi.spyOn(console, 'error').mockImplementation(() => { });

        render(<Error />);
        expect(errorMock).toHaveBeenCalledTimes(1);
    });

    it('should render without crashing ', () => {
        const { container } = render(<Error message={message} />);

        const paragraphs = [...container.getElementsByTagName('pre')];

        expect(paragraphs.some((p) => p.textContent === message)).toBeTruthy();
    });

    it('should display error logs without crashing', () => {
        const { container } = render(
            <Error message={message} logs={logs} />
        );

        const logsParagraph = container.getElementsByClassName('error-msg');

        expect(logsParagraph.item(0).textContent).toEqual(logs.join(''));
    });

    it('should render children without crashing', () => {
        const htmlNode = <div data-testid="child"></div>;
        const { getByTestId } = render(
            <Error message={message} logs={logs}>{htmlNode}</Error>
        );

        expect(getByTestId('child')).toBeInTheDocument();
    });
});
