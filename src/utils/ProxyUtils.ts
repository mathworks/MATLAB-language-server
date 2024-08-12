// Copyright 2024 The MathWorks, Inc.

interface ProxyEnvironmentVariables {
    HTTP_PROXY?: string
    HTTPS_PROXY?: string
    NO_PROXY?: string
}

const proxyEnvironmentVariables: ProxyEnvironmentVariables = {}

/**
 * Workaround for connection issue with proxy environments: cache values for HTTP_PROXY,
 * HTTPS_PROXY, and NO_PROXY environment variables, then delete variables from environment.
 */
export function cacheAndClearProxyEnvironmentVariables (): void {
    const http_proxy = process.env.HTTP_PROXY ?? process.env.http_proxy
    const https_proxy = process.env.HTTPS_PROXY ?? process.env.https_proxy
    const no_proxy = process.env.NO_PROXY ?? process.env.no_proxy
    delete process.env.HTTP_PROXY
    delete process.env.http_proxy
    delete process.env.HTTPS_PROXY
    delete process.env.https_proxy
    delete process.env.NO_PROXY
    delete process.env.no_proxy

    if (http_proxy != null) {
        proxyEnvironmentVariables.HTTP_PROXY = http_proxy
    }
    if (https_proxy != null) {
        proxyEnvironmentVariables.HTTPS_PROXY = https_proxy
    }
    if (no_proxy != null) {
        proxyEnvironmentVariables.NO_PROXY = no_proxy
    }
}

/**
 * Determines if running within a proxy environment.
 * 
 * @returns True if within a proxy environment, false otherwise
 */
export function isProxyEnvironment (): boolean {
    return Object.keys(proxyEnvironmentVariables).length > 0
}

/**
 * Gets any proxy environment variables and their values that had been set prior to
 * `cacheAndClearProxyEnvironmentVariables` being called.
 * 
 * @returns An object containing any proxy-related environment variables and their values
 */
export function getProxyEnvironmentVariables (): ProxyEnvironmentVariables {
    return proxyEnvironmentVariables
}
