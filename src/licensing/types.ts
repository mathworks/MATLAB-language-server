// Copyright 2024 The MathWorks, Inc.

// HTTP Response types
export type ErrorResponse = {'message': string, logs: string | null, type: string} | null

export type LicensingInfoResponse = {
    type: typeof MHLMLicenseType
    emailAddress: string
    entitlements: Entitlement[]
    entitlementId: string | null
} | {
    type: typeof NLMLicenseType
    connectionString: string
} | {
    type: typeof ExistingLicenseType
} | Record<string, never>;

export interface CreateStatusResponse {
    matlab: {
        version: string | null
    }
    wsEnv: string
    error: ErrorResponse
    warnings: string[]
    licensing: LicensingInfoResponse
}

// Auth token types
export type AuthToken = string | null;
export type ValidAuthToken = string;

// Licensing data types
export const MHLMLicenseType = 'mhlm';
export const NLMLicenseType = 'nlm';
export const ExistingLicenseType = 'existing_license'

export interface Entitlement {
    id: string
    label: string
    license_number: string
}

export type NoLicensingData = null

export interface MHLMLicensingData {
    type: typeof MHLMLicenseType
    identity_token: string
    source_id: string
    expiry: string
    email_addr: string
    first_name: string
    last_name: string
    display_name: string
    user_id: string
    profile_id: string
    entitlements: Entitlement[]
    entitlement_id: string | null
}

export type CachedMHLMLicensingData = Omit<MHLMLicensingData, 'entitlement_id'> & {
    // entitlement_id is not a Union type in CachedMHLMLicensingData
    entitlement_id: string
    matlab: {
        version: string
    }
}

export interface FailedMHLMLicensingData {
    type: typeof MHLMLicenseType
    identity_token: null
    source_id: null
    expiry: null
    email_addr: string
    first_name: null
    last_name: null
    display_name: null
    user_id: null
    profile_id: null
    entitlements: Entitlement[]
    entitlement_id: null
}

export interface NLMLicensingData {
    type: typeof NLMLicenseType
    conn_str: string
}

export interface ExistingLicenseData {
    type: typeof ExistingLicenseType
}

interface VersionInfoContent {
    version: string
    release: string
    description: string
    date: string
    checksum: string
}

export interface VersionInfoXML {
    MathWorks_version_info: VersionInfoContent
}

export type LicensingData = NoLicensingData | MHLMLicensingData | FailedMHLMLicensingData | CachedMHLMLicensingData | NLMLicensingData | ExistingLicenseData;
export type ValidCachedLicensingData = CachedMHLMLicensingData | NLMLicensingData | ExistingLicenseData

/**
 * Checks if the provided LicensingData is of type MHLMLicensingData.
 *
 * @param data - The LicensingData object to check.
 * @returns A boolean indicating whether the data is of type MHLMLicensingData.
 */
export function isMHLMLicensingDataType (data: LicensingData): boolean {
    return typeof data === 'object' && data !== null &&
    'identity_token' in data && data.identity_token !== null &&
    'source_id' in data && data.source_id !== null &&
    'expiry' in data && data.expiry !== null &&
    'entitlement_id' in data
}

/**
 * Checks if the provided LicensingData is of type NLMLicensingData.
 *
 * @param data - The LicensingData object to check.
 * @returns A boolean indicating whether the data is of type NLMLicensingData.
 */
export function isNLMLicensingDataType (data: LicensingData): boolean {
    return typeof data === 'object' && data != null &&
    Object.keys(data).length === 2 &&
    'conn_str' in data && data.conn_str !== null;
}

/**
 * Checks if the provided LicensingData is of type ExistingLicenseData.
 *
 * @param data - The LicensingData object to check.
 * @returns A boolean indicating whether the data is of type ExistingLicenseData.
 */
export function isExistingLicensingDataType (data: LicensingData): boolean {
    return typeof data === 'object' && data != null &&
    Object.keys(data).length === 1 &&
    'type' in data && data.type === ExistingLicenseType;
}

/**
 * Checks if the provided LicensingData is of type NoLicensingData (null).
 *
 * @param data - The LicensingData object to check.
 * @returns A boolean indicating whether the data is of type NoLicensingData (null).
 */
export function isNoLicensingDataType (data: LicensingData): boolean {
    return data === null;
}
