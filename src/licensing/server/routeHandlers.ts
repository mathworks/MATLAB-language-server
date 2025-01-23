// Copyright 2024 The MathWorks, Inc.

import { Request, Response } from 'express';
import * as path from 'path';
import * as tokenAuth from './tokenAuth';
import { getMatlabVersion } from '../config';
import Licensing from '../index';
import { marshalErrorInfo, marshalLicensingInfo } from '../../utils/LicensingUtils';
import * as config from '../config'
import { CreateStatusResponse } from '../types';
import { InvalidTokenError } from '../errors';
import NotificationService, { Notification } from '../../notifications/NotificationService';
import { matlabLifecycleManager } from './index';

let tokenAuthError: InvalidTokenError | null = null;

/**
 * Creates a status response object containing MATLAB version, environment suffix, error information, warnings, and licensing information.
 * @param licensing - The Licensing object containing licensing data.
 * @returns {CreateStatusResponse} An object representing the status response with MATLAB version, environment suffix, error information, warnings, and licensing information.
 */
async function createStatusResponse (licensing: Licensing): Promise<CreateStatusResponse> {
    return await getMatlabVersion().then(version => {
        return {
            matlab: {
                version
            },
            wsEnv: '',
            error: marshalErrorInfo((tokenAuthError != null) ? tokenAuthError : licensing.error),
            warnings: [],
            licensing: marshalLicensingInfo(licensing.data)
        }
    })
}

/**
 * Retrieves the environment configuration including the MATLAB version and supported versions.
 * @param _req - The Express request object (not used).
 * @param res - The Express response object.
 * @returns {Promise<void>} A promise that resolves when the environment config is sent as a response.
 */
export async function getEnvConfig (req: Request, res: Response): Promise<void> {
    return await getMatlabVersion().then(version => {
        res.send({
            matlab: {
                version
            },
            authentication: {
                enabled: config.MWI_ENABLE_TOKEN_AUTH,
                status: tokenAuth.isRequestAuthentic(req)
            }
        })
    })
}

/**
 * Retrieves the licensing status, including MATLAB version, licensing information, error information, and warnings.
 * @param _req - The Express request object (not used).
 * @param res - The Express response object.
 * @returns {Promise<void>} A promise that resolves when the server status is sent as a response.
 */
export async function getStatus (_req: Request, res: Response): Promise<void> {
    const licensing = new Licensing();
    res.send(await createStatusResponse(licensing))
}

/**
 * Fallback endpoint for handling requests coming from the React application.
 * Serves the index.html file from the build directory.
 * @param _req - The Express request object (not used).
 * @param res - The Express response object.
 */
export async function fallbackEndpoint (_req: Request, res: Response): Promise<void> {
    res.sendFile(path.join(__dirname, '/build/index.html'));
}

/**
 * Sets the licensing information for MATLAB.
 * @param req - The Express request object containing the licensing information in the request body.
 * @param res - The Express response object.
 * @returns {Promise<void>} A promise that resolves when the server status is sent as a response.
 */
export async function setLicensingInfo (req: Request, res: Response): Promise<void> {
    const licensing = new Licensing();
    const jsonData = req.body

    // If user needed to provide matlabVersion (as it was not determinable in getEnvConfig)
    // then update in config.
    if ('matlabVersion' in jsonData) {
        config.setMatlabVersion(jsonData.matlabVersion)
    }

    await licensing.setLicensingInfo(jsonData)

    if (licensing.error == null) {
        // Start licensed MATLAB if there's no error related to licensing
        matlabLifecycleManager.eventEmitter.emit('StartLicensedMatlab')
    } else {
        // When there is a licensing error, unset the matlabVersion in config
        // if it was sent by the front-end
        if ('matlabVersion' in jsonData) {
            config.setMatlabVersion('')
        }
    }

    res.send(await createStatusResponse(licensing))
    NotificationService.sendNotification(Notification.LicensingData, licensing.getMinimalLicensingInfo())
}

/**
 * Deletes the licensing information for MATLAB.
 * @param _req - The Express request object (not used).
 * @param res - The Express response object.
* @returns {Promise<void>} A promise that resolves when the server status is sent as a response.
 */
export async function deleteLicensingInfo (_req: Request, res: Response): Promise<void> {
    const licensing = new Licensing();
    await licensing.unsetLicensing()

    res.send(await createStatusResponse(licensing))
}

/**
 * Updates the user-selected entitlement information for MATLAB.
 * @param req - The Express request object containing the entitlement ID in the request body.
 * @param res - The Express response object.
 * @returns {Promise<void>} A promise that resolves when the server status is sent as a response.
 */
export async function updateEntitlement (req: Request, res: Response): Promise<void> {
    const licensing = new Licensing();
    const jsonData = req.body

    const entitlementId = jsonData.entitlement_id

    await licensing.updateUserSelectedEntitlementInfo(entitlementId)
    if (licensing.error == null) {
        // Start licensed MATLAB if there's no error related to licensing
        matlabLifecycleManager.eventEmitter.emit('StartLicensedMatlab')
    }

    res.send(await createStatusResponse(licensing))
    NotificationService.sendNotification(Notification.LicensingData, licensing.getMinimalLicensingInfo())
}

/**
 * Authenticates the user based on the token provided in the request.
 * @param req - The Express request object containing the authentication token.
 * @param res - The Express response object.
 * @returns {Promise<void>} A promise that resolves when the authentication status is sent as a response.
 */
export async function authenticate (req: Request, res: Response): Promise<void> {
    const isAuthentic = tokenAuth.isRequestAuthentic(req);
    tokenAuthError = isAuthentic ? null : new InvalidTokenError('Token invalid. Please enter a valid token to authenticate');

    const status = {
        status: isAuthentic,
        error: marshalErrorInfo(tokenAuthError)
    }

    res.send(status)
}
