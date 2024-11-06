// Copyright 2024 The MathWorks, Inc.

export class AppError extends Error {
    /**
     * A Generic Parent class which inherits the Error class.
     * This class will be inherited by other classes representing specific exceptions.
     *
     * @param message - Error message.
     * @param logs - Logs associated with the error.
     * @param stacktrace - Stacktrace associated with the error.
     */
    constructor(
        message: string,
        public readonly logs: string | null = null,
        public readonly stacktrace: string | null = null
    ) {
        super(message);
        this.name = this.constructor.name;
    }
}

/**
 * A Class which inherits the AppError class.
 * This class represents any Licensing Errors (MHLM and NLM Licensing)
 */
export class LicensingError extends AppError {}

/**
 * A Class which inherits the Licensing class.
 * This class represents any errors specific to MHLM Licensing.
 */
export class OnlineLicensingError extends LicensingError {}

/**
 * A Class which inherits the LicensingError class.
 * This class represents errors with Entitlements in MHLM Licensing.
 */
export class EntitlementError extends LicensingError {}

/**
 * A Class which inherits the AppError class.
 * This class represents token authentication errors.
 */
export class InvalidTokenError extends AppError {}
