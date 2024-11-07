// Copyright 2024 The MathWorks, Inc.

import { HttpsProxyAgent, HttpProxyAgent } from 'hpagent';

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
    const httpProxy = process.env.HTTP_PROXY ?? process.env.http_proxy
    const httpsProxy = process.env.HTTPS_PROXY ?? process.env.https_proxy
    const noProxy = process.env.NO_PROXY ?? process.env.no_proxy
    delete process.env.HTTP_PROXY
    delete process.env.http_proxy
    delete process.env.HTTPS_PROXY
    delete process.env.https_proxy
    delete process.env.NO_PROXY
    delete process.env.no_proxy

    if (httpProxy != null) {
        proxyEnvironmentVariables.HTTP_PROXY = httpProxy
    }
    if (httpsProxy != null) {
        proxyEnvironmentVariables.HTTPS_PROXY = httpsProxy
    }
    if (noProxy != null) {
        proxyEnvironmentVariables.NO_PROXY = noProxy
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

/**
 * Returns an HTTP or HTTPS proxy agent based on the provided URL.
 *
 * @param url - The URL to determine the proxy agent for.
 * @returns {HttpProxyAgent | HttpsProxyAgent | undefined} - The proxy agent, or undefined if no proxy is used.
 */
export function getProxyAgent (url: string): HttpProxyAgent | HttpsProxyAgent | undefined {
    const parsedUrl = new URL(url);

    if (!isProxyEnvironment()) {
        return undefined;
    }

    const proxyEnvironmentVariables = getProxyEnvironmentVariables()

    // Determine if we should bypass the proxy
    const noProxy = proxyEnvironmentVariables.NO_PROXY;
    if (typeof noProxy !== 'undefined' && noProxy !== null && noProxy.trim() !== '') {
        const noProxyHosts = noProxy.split(',').map(host => host.trim());
        if (noProxyHosts.includes(parsedUrl.hostname)) {
            return undefined;
        }
    }

    // Determine which proxy to use based on the protocol
    if (parsedUrl.protocol === 'http:') {
        const httpProxy = proxyEnvironmentVariables.HTTP_PROXY;
        if (httpProxy !== undefined && httpProxy !== null && httpProxy !== '') {
            return new HttpProxyAgent({
                proxy: httpProxy
            });
        }
    }

    if (parsedUrl.protocol === 'https:') {
        const httpsProxy = proxyEnvironmentVariables.HTTPS_PROXY;
        if (httpsProxy !== undefined && httpsProxy !== null && httpsProxy !== '') {
            return new HttpProxyAgent({
                proxy: httpsProxy
            });
        }
    }

    return undefined;
}
