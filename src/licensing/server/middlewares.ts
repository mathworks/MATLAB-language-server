// Copyright 2024 The MathWorks, Inc.

import express from 'express';
import cookieParser from 'cookie-parser';
import session from 'express-session';
import crypto from 'crypto';

import { isRequestAuthentic } from './tokenAuth';

import { MWI_LICENSING_SESSION_COOKIE_NAME, MWI_AUTH_TOKEN_LENGTH } from '../config'

/**
 * Middleware function to authenticate an incoming request.
 * If the request is authentic, passes control to the next middleware or route handler.
 * If not, sends a 403 Forbidden response.
 * @param req - The Express request object.
 * @param res - The Express response object.
 * @param next - The next function to pass control to the next middleware/route handler.
 * @returns {void}
 */
export async function authenticateRequest (req: express.Request, res: express.Response, next: express.NextFunction): Promise<void> {
    if (await isRequestAuthentic(req)) {
        next(); // Handover the request to the endpoint
    } else {
        res.sendStatus(403); // Return 403 immediately without handing over the request to the endpoint.
    }
}

/**
 * Adds various middlewares to an Express server instance.
 * @param server - The Express server instance to which middlewares will be added.
 * @param buildPath - The path to the directory containing static files to serve.
 * @returns {void}
 */
export function addMiddlwares (server: express.Express, buildPath: string): void {
    // Adds paths to static file content
    server.use(express.static(buildPath));

    // Adds ability to parse json
    server.use(express.json());

    // Adds ability to parse cookies
    server.use(cookieParser());

    // Adds ability to create sessions
    const uniqifySessionCookie = crypto.randomBytes(16).toString('hex');
    server.use(session({
        name: `${MWI_LICENSING_SESSION_COOKIE_NAME}-${uniqifySessionCookie}`, // Unique session cookie name
        secret: crypto.randomBytes(MWI_AUTH_TOKEN_LENGTH).toString('hex'), // Use a secure random secret
        resave: false,
        saveUninitialized: true,
        cookie: {
            secure: false
        }
    }));
}
