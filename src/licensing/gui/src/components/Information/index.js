// Copyright 2024 The MathWorks, Inc.

import React, { useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { useSelector, useDispatch } from 'react-redux';
import Linkify from 'react-linkify';
import {
    selectError,
    selectWarnings,
    selectOverlayHidable,
    selectInformationDetails,
    selectAuthEnabled,
    selectIsAuthenticated,
    selectAuthToken
} from '../../selectors';
import { updateAuthStatus, getAuthToken } from '../../actionCreators';
import './Information.css';

function Information () {
    const error = useSelector(selectError);
    const warnings = useSelector(selectWarnings);
    const overlayHidable = useSelector(selectOverlayHidable);

    const [token, setToken] = useState('');
    const authEnabled = useSelector(selectAuthEnabled);
    const isAuthenticated = useSelector(selectIsAuthenticated);
    const authToken = useSelector(selectAuthToken);
    const dispatch = useDispatch();
    const tokenInput = useRef();

    const [errorLogsExpanded, setErrorLogsExpanded] = useState(false);
    const [warningsExpanded, setWarningsExpanded] = useState(true);

 
    const details = useSelector(selectInformationDetails);

    const errorMessageNode = error
        ? (
            <div className="error-container alert alert-danger">
                <p><strong>Error</strong></p>
                <Linkify>
                    <div className="error-text"><pre style={{ backgroundColor: 'hsla(0,0%,100%,0)', border: 'none', fontFamily: 'inherit', fontSize: '15px' }}>{error.message}</pre></div>
                </Linkify>
            </div>
        )
        : null;

    const errorLogsNode = (error && error.logs !== null && error.logs.length > 0)
        ? (
            <div className="expand_collapse error-logs-container">
                <h4 className={`expand_trigger ${errorLogsExpanded ? 'expanded' : 'collapsed'}`}
                    onClick={() => setErrorLogsExpanded(!errorLogsExpanded)}>
                    <span className="icon-arrow-open-down"></span>
                    <span className="icon-arrow-open-right"></span>
                Error logs
                </h4>
                <div id="error-logs"
                    className={`expand_target error-container alert alert-danger ${errorLogsExpanded ? 'expanded' : 'collapsed'}`}
                    aria-expanded={errorLogsExpanded}>
                    <Linkify>
                        <div className="error-msg">{error.logs.join('\n').trim()}</div>
                    </Linkify>
                </div>
            </div>
        )
        : null;

    const linkDecorator = (href, text, key) => (
        <a href={href} key={key} target="_blank" rel="noopener noreferrer">
            {text}
        </a>
    );

    const warningsNode = (warnings && warnings.length > 0)
        ? (
            <div className="expand_collapse warnings-container">
                <h4 className={`expand_trigger ${warningsExpanded ? 'expanded' : 'collapsed'}`}
                    onClick={() => setWarningsExpanded(!warningsExpanded)}>
                    <span className="icon-arrow-open-down"></span>
                    <span className="icon-arrow-open-right"></span>
                Warnings
                </h4>
                <div id="warnings"
                    className={`expand_target warnings-container alert alert-warning ${warningsExpanded ? 'expanded' : 'collapsed'}`}
                    aria-expanded={warningsExpanded}>
                    <Linkify componentDecorator={linkDecorator}>
                        <div className="warnings-msg">{warnings.map((warning, index) => (index + 1).toString() + ')' + warning.trim()).join('\n\n')}</div>
                    </Linkify>
                </div>
            </div>
        )
        : null;


    const toggleVisibility = () => {
        tokenInput.current.type = tokenInput.current.type === 'text' ? 'password' : 'text';
    };

    const authenticate = async (token) => {
        // Update redux state with the token after validation from the backend
        dispatch(updateAuthStatus(token.trim()));

        // Reset local state variable which was used to hold user's input for token.
        setToken('');
    };

    return (
        <div className="modal show"
            id="information"
            tabIndex="-1"
            role="dialog"
            aria-labelledby="information-dialog-title"
            aria-describedby="information-dialog">
            <div className="modal-dialog modal-dialog-centered" role="document">
                <div className={`modal-content alert alert-${details.alert}`}>
                    <div className="modal-header">
                        {
                            overlayHidable && (
                                <button
                                    type="button"
                                    className="close"
                                    data-dismiss="modal"
                                    aria-label="Close">
                                    <span aria-hidden="true">&times;</span>
                                </button>
                            )
                        }
                        <span className={`alert_icon icon-alert-${details.icon}`} />
                        <h4 className="modal-title alert_heading" id="information-dialog-title">Status Information</h4>
                    </div >
                    <div className="modal-body">
                        <div className="details">
                            <div className='flex-container'>
                                {authEnabled &&
                                    <>
                                        <div className="flex-item-1">
                                           Please Authenticate                                        
                                        </div>                                      
                                            { !isAuthenticated && 
                                                <div className="flex-item-2">
                                                    <form id="token-form" onSubmit={(e) => e.preventDefault()} className='flex-container'>
                                                        <input

                                                            ref={tokenInput}
                                                            onBlur={toggleVisibility}
                                                            onFocus={toggleVisibility}
                                                            className='flex-item-2'
                                                            id='token' name='token' placeholder=' Please enter auth token' type='password' value={token} onChange={(e) => setToken(e.target.value)}/>

                                                        <button onClick={() => authenticate(token)} className="btn btn_color_blue token-btn"
                                                        >Submit</button>
                                                    </form>
                                                </div>
                                            }
                                        
                                    </>
                                }
                            </div>
                        </div>
                        {errorMessageNode}
                        {errorLogsNode}
                        {warningsNode}
                    </div>                   
                </div>
            </div>
        </div>
    );
}


export default Information;
