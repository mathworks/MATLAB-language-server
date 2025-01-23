// Copyright 2024 The MathWorks, Inc.

import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

import { getMatlabVersion } from './config';
import { fetchAccessToken, fetchExpandToken, fetchEntitlements } from './mw';
import { writeJSONDataToFile, deleteFile, createDirectoryIfNotExist } from '../utils/FsUtils';
import { OnlineLicensingError, EntitlementError, LicensingError, AppError } from './errors';
import { ExistingLicenseType, FailedMHLMLicensingData, LicensingData, MHLMLicenseType, MHLMLicensingData, NLMLicenseType, NLMLicensingData, ValidCachedLicensingData, isMHLMLicensingDataType, isNLMLicensingDataType, isExistingLicensingDataType, isNoLicensingDataType } from './types';
import NotificationService, { Notification } from '../notifications/NotificationService'
import Logger from '../logging/Logger';
import * as config from './config';

/**
 * The `Licensing` class is responsible for managing the licensing information for the application.
 * It handles the initialization of licensing, fetching and persisting licensing data, and setting up environment variables for MATLAB.
 * The class is designed as a singleton, ensuring there is only one instance of `Licensing` in the application.
 */
export default class Licensing {
    static instance: Licensing;
    // NOTE: If wsEnv's are introduced, ./server/routeHandlers.ts::createStatusResponse() return
    // value needs to be updated accordingly.
    static mwaApiEndpoint: string = 'https://login.mathworks.com/authenticationws/service/v4';
    static mhlmApiEndpoint: string = 'https://licensing.mathworks.com/mls/service/v1/entitlement/list'

    static mwiConfigFolderPath: string = path.join(os.homedir(), '.matlab', 'MWI', 'hosts', os.hostname())
    static mwiConfigFilePath: string = path.join(Licensing.mwiConfigFolderPath, 'proxy_app_config.json')

    static type = {
        NO_LICENSE: '',
        MHLM_LICENSE: ' as',
        NLM_LICENSE: ' using',
        EXISTING_LICENSE: '.'
    }

    data: LicensingData = null;
    error: AppError | null = null;

    /**
     * Creates an instance of the `Licensing` class.
     * If an instance already exists, it returns the existing instance.
     */
    constructor () {
        if (Licensing.instance !== undefined) {
            return Licensing.instance;
        }

        this.data = null;
        this.error = null;

        // Create the folder for storing proxy_app_config.json file
        void this.createCachedConfigDirectory()

        // Initialize licensing
        void this.initializeLicensing()

        // Update static variable to make this object a singleton instance
        Licensing.instance = this;
    }

    /**
     * Initializes the licensing information.
     * It checks for the presence of an NLM connection string in the environment variables or a cached licensing configuration file.
     * Based on the available information, it sets the appropriate licensing data.
     * @private
     */
    private async initializeLicensing (): Promise<void> {
        this.data = null;

        const nlmConnectionStringInEnv = process.env.MLM_LICENSE_FILE
        const mwiConfigFileExists = fs.existsSync(Licensing.mwiConfigFilePath)

        if (nlmConnectionStringInEnv !== undefined) {
            Logger.log(`Found MLM_LICENSE_FILE environment variable set to: ${nlmConnectionStringInEnv}. Using it for licensing MATLAB`)
            this.data = {
                type: 'nlm',
                conn_str: nlmConnectionStringInEnv
            }
            await this.deleteCachedConfigFile()
        } else if (mwiConfigFileExists) {
            try {
                const data = JSON.parse(fs.readFileSync(Licensing.mwiConfigFilePath, 'utf8'))
                Logger.log('Found cached licensing information...')
                const cachedLicensingData = data.licensing as ValidCachedLicensingData

                if (cachedLicensingData.type === NLMLicenseType) {
                    this.data = {
                        type: NLMLicenseType,
                        conn_str: cachedLicensingData.conn_str
                    }
                } else if (cachedLicensingData.type === MHLMLicenseType) {
                    this.data = {
                        type: MHLMLicenseType,
                        identity_token: cachedLicensingData.identity_token,
                        source_id: cachedLicensingData.source_id,
                        expiry: cachedLicensingData.expiry,
                        email_addr: cachedLicensingData.email_addr,
                        first_name: cachedLicensingData.first_name,
                        last_name: cachedLicensingData.last_name,
                        display_name: cachedLicensingData.display_name,
                        user_id: cachedLicensingData.user_id,
                        profile_id: cachedLicensingData.profile_id,
                        entitlements: [],
                        entitlement_id: cachedLicensingData.entitlement_id
                    }

                    // If 'matlab' field exists in the data, then update it in the config.
                    if ('matlab' in data) {
                        config.setMatlabVersion(data.matlab.version)
                    }

                    const expiry = new Date(this.data.expiry)
                    const expiryWindow = new Date(expiry.getTime() - 3600000); // subtract 1 hour

                    if (expiryWindow.getTime() > (new Date()).getTime()) {
                        const successfulUpdate = await this.updateAndPersistLicensing();
                        if (successfulUpdate) {
                            console.debug('Using cached Online Licensing to launch MATLAB.');
                        } else {
                            void this.resetAndDeleteCachedConfig();
                            NotificationService.sendNotification(Notification.LicensingError, 'Failed to fetch entitlements. Resetting cached licensing information.')
                        }
                    }
                } else if (cachedLicensingData.type === ExistingLicenseType) {
                    this.data = cachedLicensingData
                } else {
                    void this.resetAndDeleteCachedConfig();
                    NotificationService.sendNotification(Notification.LicensingError, 'Failed to determine licensing type. Resetting cached licensing information.')
                }
            } catch (e) {
                NotificationService.sendNotification(Notification.LicensingError, 'Something went wrong when reading cached licensing info. Resetting cached licensing information.')
                void this.resetAndDeleteCachedConfig();
            }
        } else {
            Logger.log('Cached licensing not found...');
        }
    }

    /**
     * Checks if the application is licensed.
     * @returns {boolean} `true` if the application is licensed, `false` otherwise.
     */
    isLicensed (): boolean {
        return this.isMHLMLicensing() || this.isNLMLicensing() || this.isExistingLicensing()
    }

    /**
     * Gets the email address associated with the MHLM licensing.
     * @returns {string | null} The email address if MHLM licensing is configured, `null` otherwise.
     */
    getMHLMEmailAddress (): string | null {
        if (this.isMHLMLicensing()) {
            return (this.data as MHLMLicensingData).email_addr;
        }
        return null;
    }

    /**
     * Checks if the licensing type is MHLM (Online License Manager).
     * @private
     * @returns {boolean} `true` if the licensing type is MHLM, `false` otherwise.
     */
    isMHLMLicensing (): boolean {
        return isMHLMLicensingDataType(this.data);
    }

    /**
     * Checks if the licensing type is NLM (Network License Manager).
     * @private
     * @returns {boolean} `true` if the licensing type is NLM, `false` otherwise.
     */
    isNLMLicensing (): boolean {
        return isNLMLicensingDataType(this.data)
    }

    /**
     * Checks if the licensing type is an existing license.
     * @private
     * @returns {boolean} `true` if the licensing type is an existing license, `false` otherwise.
     */
    isExistingLicensing (): boolean {
        return isExistingLicensingDataType(this.data)
    }

    /**
     * Checks if there is no licensing configured.
     * @private
     * @returns {boolean} `true` if there is no licensing configured, `false` otherwise.
     */
    isNoLicensing (): boolean {
        return isNoLicensingDataType(this.data);
    }

    /**
     * Gets the minimal licensing information as a string.
     * @returns {string} The minimal licensing information.
     */
    getMinimalLicensingInfo (): string {
        if (this.isMHLMLicensing()) {
            return `${Licensing.type.MHLM_LICENSE} ${this.getMHLMEmailAddress() as string}`
        } else if (this.isNLMLicensing()) {
            return `${Licensing.type.NLM_LICENSE} ${(this.data as NLMLicensingData).conn_str}`
        } else if (this.isExistingLicensing()) {
            return Licensing.type.EXISTING_LICENSE;
        }

        return ''
    }

    /**
     * Unsets the licensing information and deletes the cached configuration file.
     */
    async unsetLicensing (): Promise<void> {
        this.data = null
        if ((this.error != null) && this.error instanceof LicensingError) {
            this.error = null
        }
        await this.deleteCachedConfigFile()
        console.log('Successfully unset licensing')
    }

    /**
     * Sets the licensing information based on the provided data.
     * @param licenseData - The licensing data to be set.
     */
    async setLicensingInfo (licenseData: any): Promise<void> { // eslint-disable-line
        if (!licenseData.hasOwnProperty('type') || ![MHLMLicenseType, NLMLicenseType, ExistingLicenseType].includes(licenseData.type)) {  // eslint-disable-line
            throw new Error("Incorrect values supplied. Licensing type must be 'NLM', 'MHLM' or 'ExistingLicense'")
        }

        const type = licenseData.type

        if (type === MHLMLicenseType) {
            await this.setLicensingToMHLM(licenseData)
        } else if (type === NLMLicenseType) {
            this.setLicensingToNLM(licenseData)
        } else {
            this.setLicensingToExistingLicense()
        }
    }

    /**
     * Sets up the environment variables required for MATLAB based on the licensing information.
     * @returns {NodeJS.ProcessEnv} The environment variables.
     */
    async setupEnvironmentVariables (): Promise<NodeJS.ProcessEnv> {
        const environmentVariables: NodeJS.ProcessEnv = {}

        // Is not licensed or existing license return early.
        if (!this.isLicensed()) {
            return environmentVariables
        }

        if (this.isMHLMLicensing()) {
            const mhlmData = this.data as MHLMLicensingData;

            const accessTokenData: { token: string } | null = await fetchAccessToken(
                Licensing.mwaApiEndpoint,
                mhlmData.identity_token,
                mhlmData.source_id
            );

            if (accessTokenData !== null) {
                environmentVariables.MLM_WEB_LICENSE = 'true'
                environmentVariables.MLM_WEB_USER_CRED = accessTokenData.token
                environmentVariables.MLM_WEB_ID = mhlmData.entitlement_id as string
            }
        } else if (this.isNLMLicensing()) {
            const nlmData = this.data as NLMLicensingData;
            environmentVariables.MLM_LICENSE_FILE = nlmData.conn_str
        }

        Logger.log('Successfully marshaled environment variables for MATLAB')

        return environmentVariables
    }

    /**
     * Sets the licensing information to MHLM (Online License Manager).
     * @param licenseData - The MHLM licensing data.
     * @private
     */
    private async setLicensingToMHLM (licenseData: any): Promise<void> {  // eslint-disable-line
        const { token: identityToken, sourceId, emailAddress } = licenseData;

        try {
            const expandTokenData = await fetchExpandToken(Licensing.mwaApiEndpoint, identityToken, sourceId)
            this.data = {
                type: 'mhlm',
                identity_token: identityToken,
                source_id: sourceId,
                expiry: expandTokenData.expiry,
                email_addr: emailAddress,
                first_name: expandTokenData.first_name,
                last_name: expandTokenData.last_name,
                display_name: expandTokenData.display_name,
                user_id: expandTokenData.user_id,
                profile_id: expandTokenData.profile_id,
                entitlements: [],
                entitlement_id: null
            }

            const successfulUpdate = await this.updateAndPersistLicensing()

            if (successfulUpdate) {
                Logger.log('MHLM login successful, persisting login info.')
                // Set the error back to null if MHLM login was successful.
                this.error = null;
            }
        } catch (error) {
            if (error instanceof OnlineLicensingError || error instanceof EntitlementError) {
                this.error = error;
                this.data = {
                    type: MHLMLicenseType,
                    email_addr: emailAddress
                } as FailedMHLMLicensingData
            } else {
                this.error = error as AppError
                this.data = null
            }
            Logger.error((error as Error).message)
            console.log(error)
        }
    }

    /**
     * Sets the licensing information to NLM (Network License Manager).
     * @param connectionStr - The NLM connection string.
     * @private
     */
    private setLicensingToNLM (data: any): void {  // eslint-disable-line
        const { connectionString } = data;
        this.data = {
            type: NLMLicenseType,
            conn_str: connectionString
        }

        Logger.log('Persisting NLM info.')
        void this.persistConfigData();
    }

    /**
     * Sets the licensing information to an existing license.
     * @private
     */
    private setLicensingToExistingLicense (): void {
        this.data = {
            type: ExistingLicenseType
        }
        void this.persistConfigData()
    }

    /**
     * Updates the user-selected entitlement information for MHLM licensing.
     * @param entitlementId - The entitlement ID.
     */
    async updateUserSelectedEntitlementInfo (entitlementId: string): Promise<void> {
        if (this.isMHLMLicensing()) {
            const licensingData = this.data as MHLMLicensingData
            licensingData.entitlement_id = entitlementId
            this.data = licensingData
            await this.persistConfigData()
        }
    }

    /**
     * Updates the entitlements for MHLM licensing.
     * @returns {Promise<boolean>} `true` if the entitlements were updated successfully, `false` otherwise.
     */
    async updateEntitlements (): Promise<boolean> {
        if (this.data?.type !== MHLMLicenseType) {
            const err = new LicensingError('MHLM licensing must be configured to update entitlements!')
            Logger.warn(err.message)
            this.error = err;
            return false;
        }

        const matlabVersion = await getMatlabVersion()

        if (matlabVersion === null) {
            const err = new EntitlementError('MATLAB version is required for fetching entitlements')
            this.error = err;
            Logger.warn(err.message)
            return false;
        }

        const mhlmData = this.data as MHLMLicensingData;

        try {
            const accessTokenData: { token: string } = await fetchAccessToken(
                Licensing.mwaApiEndpoint,
                mhlmData.identity_token,
                mhlmData.source_id
            );

            // Fetch entitlements
            const entitlements = await fetchEntitlements(
                Licensing.mhlmApiEndpoint,
                accessTokenData.token,
                matlabVersion
            );
            mhlmData.entitlements = entitlements;

            // Auto-select the entitlement if only one entitlement is returned from MHLM
            if (entitlements.length === 1) {
                mhlmData.entitlement_id = entitlements[0].id;
            }

            // Update the data variable
            this.data = mhlmData;

            Logger.log('Successfully fetched entitlements')

            return true;
        } catch (e) {
            if (e instanceof EntitlementError) {
                this.error = e;

                const failedMhlmData = this.data as FailedMHLMLicensingData;
                failedMhlmData.identity_token = null;
                failedMhlmData.source_id = null;
                failedMhlmData.expiry = null;
                failedMhlmData.first_name = null;
                failedMhlmData.last_name = null;
                failedMhlmData.display_name = null;
                failedMhlmData.user_id = null;
                failedMhlmData.profile_id = null;
                failedMhlmData.entitlements = [];
                failedMhlmData.entitlement_id = null;

                this.data = failedMhlmData;
                Logger.error(e.message)

                return false;
            } else if (e instanceof OnlineLicensingError) {
                this.error = e;
                Logger.error(e.message)
                return false;
            } else {
                this.error = e as AppError;
                Logger.error((e as Error).message)
                return false;
            }
        }
    }

    /**
     * Updates and persists the licensing information.
     * @private
     * @returns {Promise<boolean>} `true` if the licensing information was updated and persisted successfully, `false` otherwise.
     */
    async updateAndPersistLicensing (): Promise<boolean> {
        const successfulUpdate = await this.updateEntitlements();
        if (successfulUpdate) {
            void this.persistConfigData();
        } else {
            await this.resetAndDeleteCachedConfig();
        }
        return successfulUpdate;
    }

    /**
     * Persists the licensing and MATLAB version information to the cached configuration file.
     * @private
     */
    private async persistConfigData (): Promise<void> {
        if (this.isNoLicensing()) {
            await this.deleteCachedConfigFile()
        } else {
            const matlabVersion = await getMatlabVersion()
            const dataToWrite = {
                licensing: this.data,
                matlab: {
                    version: matlabVersion
                }
            }
            await writeJSONDataToFile(Licensing.mwiConfigFilePath, dataToWrite)
        }
    }

    /**
     * Resets and deletes the cached configuration file.
     * @private
     */
    private async resetAndDeleteCachedConfig (): Promise<void> {
        this.data = null
        await this.deleteCachedConfigFile()
        Logger.log('Successfully unset licensing')
    }

    /**
     * Deletes the cached configuration file.
     * @private
     */
    private async deleteCachedConfigFile (): Promise<void> {
        await deleteFile(Licensing.mwiConfigFilePath)
    }

    /**
     * Creates the directory for storing the cached configuration file if it doesn't exist.
     * @private
     */
    private async createCachedConfigDirectory (): Promise<void> {
        await createDirectoryIfNotExist(Licensing.mwiConfigFolderPath);
    }
}
