// Copyright 2024 The MathWorks, Inc.

import { Express } from 'express';

import { getEnvConfig, getStatus, setLicensingInfo, deleteLicensingInfo, updateEntitlement, fallbackEndpoint, authenticate } from './routeHandlers';
import { authenticateRequest } from './middlewares'

/**
 * Adds routes to the express application
 * @param app - The Express application object.
 */
export function addRoutes (app: Express): void {
    // Endpoints that do not require token authentication
    app.get('/get_env_config', getEnvConfig);
    app.get('/get_status', getStatus);
    app.post('/authenticate', authenticate);

    // Endpoints that require token authentication
    app.put('/set_licensing_info', authenticateRequest, setLicensingInfo);
    app.put('/update_entitlement', authenticateRequest, updateEntitlement);
    app.delete('/set_licensing_info', authenticateRequest, deleteLicensingInfo);

    // Fallback endpoint for handling requests coming in from react.
    // NOTE: This endpoint does not need authentication
    // NOTE: Comment out if working with react dev server
    app.get('*', fallbackEndpoint);
}
