// Copyright 2024 The MathWorks, Inc.

import React from 'react';
import { useDispatch } from 'react-redux';
import {
    fetchSetLicensing
} from '../../actionCreators';
import './ExistingLicense.css';

function ExistingLicense() {
    const dispatch = useDispatch();

    function submitForm(event) {
        event.preventDefault();
        dispatch(fetchSetLicensing({
            type: 'existing_license',
        }));
    }

    return (
        <div id="ExistingLicense">
            <form onSubmit={submitForm}>
                <div className='form-group'>                     
                    <p>
                        <b>Note</b>: Choose this option if you already have an activated MATLAB license. This option allows you to run MATLAB on your host machine without providing additional licensing information.
                    </p>
                    <br/>
                    <input type="submit" id="submit" value="Start MATLAB" className="btn btn_color_blue" />
                </div>
            </form>
        </div>
    );
}

export default ExistingLicense;