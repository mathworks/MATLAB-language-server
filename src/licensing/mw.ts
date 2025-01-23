// Copyright 2024 The MathWorks, Inc.
import * as xml2js from 'xml2js';
import sendRequest from '../utils/NetworkUtils';
import { findAllEntitlements } from '../utils/LicensingUtils';
import { EntitlementError, OnlineLicensingError } from './errors';
import { Entitlement } from './types';

interface ServerExpandTokenData {
    expirationDate: string
    referenceDetail: {
        firstName: string
        lastName: string
        displayName: string
        userId: string
        referenceId: string
    }
}

interface ServerAccessTokenData {
    accessTokenString: string
}

/**
 * Fetches an expand token from the MathWorks Access (MWA) service.
 * @param mwaUrl - The URL of the MathWorks Access service.
 * @param identityToken - The identity token to use for authentication.
 * @param sourceId - The source ID for the request.
 * @returns {Promise<{expiry: string, first_name: string, last_name: string, display_name: string, user_id: string, profile_id: string}>} A Promise that resolves with an object containing the expiry date, first name, last name, display name, user ID, and profile ID.
 * @throws {OnlineLicensingError} If there is an error fetching the access token
*/
export async function fetchExpandToken (mwaUrl: string, identityToken: string, sourceId: string): Promise<{
    expiry: string
    first_name: string
    last_name: string
    display_name: string
    user_id: string
    profile_id: string
}> {
    const accessTokenUrl = mwaUrl + '/tokens';
    const data = {
        tokenString: identityToken,
        tokenPolicyName: 'R2',
        sourceId
    }

    const formData = new URLSearchParams(data).toString();

    const options = {
        method: 'POST',
        headers: {
            'content-type': 'application/x-www-form-urlencoded',
            accept: 'application/json',
            X_MW_WS_callerId: 'desktop-jupyter'
        },
        body: formData
    }

    const response = await sendRequest(accessTokenUrl, options)

    if (response == null || !response.ok) {
        throw new OnlineLicensingError(`Communication with ${mwaUrl} failed.`)
    }
    const jsonData: ServerExpandTokenData = await response.json() as ServerExpandTokenData

    return {
        expiry: jsonData.expirationDate,
        first_name: jsonData.referenceDetail.firstName,
        last_name: jsonData.referenceDetail.lastName,
        display_name: jsonData.referenceDetail.displayName,
        user_id: jsonData.referenceDetail.userId,
        profile_id: jsonData.referenceDetail.referenceId
    }
}

/**
 * Fetches an access token from the MathWorks Access (MWA) service.
 * @param mwaUrl - The URL of the MathWorks Access service.
 * @param identityToken - The identity token to use for authentication.
 * @param sourceId - The source ID for the request.
 * @returns {Promise<{token: string}>} A Promise that resolves with an object containing the access token.
 * @throws {OnlineLicensingError} If there is an error fetching the access token
 */
export async function fetchAccessToken (mwaUrl: string, identityToken: string, sourceId: string): Promise<{token: string}> {
    const accessTokenUrl: string = mwaUrl + '/tokens/access';

    const data = {
        tokenString: identityToken,
        type: 'MWAS',
        sourceId
    }

    const formData = new URLSearchParams(data).toString();

    const options = {
        method: 'POST',
        headers: {
            'content-type': 'application/x-www-form-urlencoded',
            accept: 'application/json',
            X_MW_WS_callerId: 'desktop-jupyter'
        },
        body: formData
    }

    const response = await sendRequest(accessTokenUrl, options)
    if (response == null || !response.ok) {
        throw new OnlineLicensingError('HTTP request failed');
    }

    const jsonData: ServerAccessTokenData = await response.json() as ServerAccessTokenData
    return {
        token: jsonData.accessTokenString
    }
}

/**
 * Fetches entitlements from the MathWorks Hosted License Manager (MHLM) service.
 * @param mhlmUrl - The URL of the MathWorks Hosted License Manager service.
 * @param accessToken - The access token to use for authentication.
 * @param matlabVersion - The version of MATLAB for which to fetch entitlements.
 * @returns {Promise<Entitlement[]>} A Promise that resolves with an array of Entitlement objects.
 * @throws {EntitlementError} If there is an error fetching or parsing the entitlements.
 */
export async function fetchEntitlements (mhlmUrl: string, accessToken: string, matlabVersion: string): Promise<Entitlement[]> {
    const data = {
        token: accessToken,
        release: matlabVersion,
        coreProduct: 'ML',
        context: 'jupyter',
        excludeExpired: 'true'
    }
    const formData = new URLSearchParams(data).toString();
    const options = {
        method: 'POST',
        headers: {
            'content-type': 'application/x-www-form-urlencoded'
        },
        body: formData
    }

    const response = await sendRequest(mhlmUrl, options);
    if (response == null || !response.ok) {
        throw new EntitlementError(`Communication with ${mhlmUrl} failed`)
    }
    const text = await response.text()
    const jsonData = await xml2js.parseStringPromise(text)
    if (!Object.prototype.hasOwnProperty.call(jsonData.describe_entitlements_response, 'entitlements')) {
        throw new EntitlementError('Failed to extract entitlements');
    }
    const entitlementsData = findAllEntitlements(jsonData.describe_entitlements_response.entitlements)

    if (entitlementsData.length === 0) {
        throw new EntitlementError(`Your MathWorks account is not linked to a valid license for MATLAB ${matlabVersion}.\nSign out and login with a licensed user.`)
    }

    const entitlements: Entitlement[] = entitlementsData.map(entitlementData => {
        const entitlement: Entitlement = entitlementData[0]
        return {
            id: String(entitlement.id),
            label: String(entitlement.label),
            license_number: String(entitlement.license_number)
        }
    })

    return entitlements;
}
