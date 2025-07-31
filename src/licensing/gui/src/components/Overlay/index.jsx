// Copyright 2024 The MathWorks, Inc.

import React from 'react';
import PropTypes from 'prop-types';
import './Overlay.css';

function Overlay({
    children,
    transparent = false
}) {

    return (
        <div
            id="overlay"
            style={
                {
                    backgroundColor: transparent
                        ? 'transparent'
                        : null
                }
            }
        >
            {children}
        </div>
    );
}

Overlay.propTypes = {
    transparent: PropTypes.bool,
    children: PropTypes.oneOfType([PropTypes.node, PropTypes.arrayOf(PropTypes.node)])
};


export default Overlay;
