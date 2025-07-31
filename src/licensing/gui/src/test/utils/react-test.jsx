// Copyright 2020-2025 The MathWorks, Inc.

import { render as rtlRender } from '@testing-library/react';
import { legacy_createStore as createStore, applyMiddleware, compose } from 'redux';
import { Provider } from 'react-redux';
import PropTypes from 'prop-types';
import thunkMiddleware from 'redux-thunk';
import reducer from '../../reducers';

function render (
    ui,
    {
        initialState,
        store = createStore(
            reducer,
            initialState,
            compose(applyMiddleware(thunkMiddleware))
        ),
        ...renderOptions
    } = {}
) {
    function Wrapper ({ children }) {
        return <Provider store={store}>{children}</Provider>;
    }
    Wrapper.propTypes = {
        children: PropTypes.oneOfType([PropTypes.node, PropTypes.arrayOf(PropTypes.node)])
    };
    return rtlRender(ui, { wrapper: Wrapper, ...renderOptions });
}

export { render };
