// Copyright 2024 The MathWorks, Inc.

import { Request } from 'express';

import * as crypto from 'crypto';

import { MWI_AUTH_TOKEN_NAME_FOR_HTTP } from '../config'
import { AuthToken, ValidAuthToken } from '../types';

let authToken: string | null; let authTokenHashed: string | null = null;

/**
 * Checks if the authentication token is present in the session cookie and is valid.
 * @param  req - The Express request object.
 * @returns True if the token is valid and present in the session cookie, otherwise false.
 */
function isAuthTokenInSessionCookie (req: Request): boolean {
    const token = req.session['mwi-auth-token'];
    if (isValidToken(token)) {
        return true;
    }
    return false;
}

/**
 * Checks if the authentication token is present in the request headers and is valid.
 * If the token is valid, it is also stored in the session cookie.
 * @param req - The Express request object.
 * @returns True if the token is valid and present in the request headers, otherwise false.
 */
function isAuthTokenInRequestHeaders (req: Request): boolean {
    const token = req.headers[MWI_AUTH_TOKEN_NAME_FOR_HTTP] as string;
    if (isValidToken(token)) {
        req.session['mwi-auth-token'] = token;
        return true;
    }
    return false;
}

/**
 * Checks if the authentication token is present in the request parameters and is valid.
 * @param req - The Express request object.
 * @returns True if the token is valid and present in the request parameters, otherwise false.
 */
function isAuthTokenInRequestParams (req: Request): boolean {
    const token = req.query[MWI_AUTH_TOKEN_NAME_FOR_HTTP] as string;

    if (isValidToken(token)) {
        return true;
    }
    return false;
}

/**
 * Generates a new authentication token of the specified length if one does not already exist.
 * The token is then hashed and stored.
 * @param length - The length of the authentication token to generate.
 * @returns The generated authentication token.
 */
export function generateAuthToken (length: number): ValidAuthToken {
    if (isValidToken(authToken)) {
        return authToken as string;
    }

    authToken = crypto.randomBytes(length).toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '')
        .substring(0, length);

    const hash = crypto.createHash('sha256');
    hash.update(authToken);
    authTokenHashed = hash.digest('hex')

    return authToken;
}

/**
 * Retrieves the current authentication token.
 * @returns The current authentication token.
 */
export function getAuthToken (): AuthToken {
    return authToken
}

/**
 * Checks if the incoming request is authentic by verifying the presence and validity of the authentication token
 * in the session cookie, request headers, or request parameters.
 * @param req - The Express request object.
 * @returns True if the request is authentic, otherwise false.
 */
export function isRequestAuthentic (req: Request): boolean {
    return isAuthTokenInSessionCookie(req) || isAuthTokenInRequestHeaders(req) || isAuthTokenInRequestParams(req)
}

/**
 * Validates the provided authentication token against the stored token and its hashed version.
 * @param token - The token to validate.
 * @returns True if the token is valid, otherwise false.
 */
function isValidToken (token: string | null | undefined): boolean {
    return token !== null && token !== undefined && (token === authToken || token === authTokenHashed)
}
