// Copyright 2022 - 2024 The MathWorks, Inc.

import { EventEmitter } from 'events'

import ConfigurationManager, { Argument } from "./ConfigurationManager"
import { MatlabConnection } from "./MatlabCommunicationManager"
import MatlabSession, { launchNewMatlab, connectToMatlab } from './MatlabSession'

class MatlabLifecycleManager {
    eventEmitter = new EventEmitter()

    private matlabSession: MatlabSession | null = null
    private connectionPromise: Promise<MatlabSession> | null = null

    /**
     * Gets the current connection to MATLAB.
     * 
     * @param startMatlab If no existing MATLAB connection exists, this determines whether
     * a new connection should be established. If true, this will attempt to establish a
     * new connection. If false, it will not and will return null.
     *
     * @returns The MATLAB connection object, or null if no connection exists.
     */
    async getMatlabConnection (startMatlab: boolean = false): Promise<MatlabConnection | null> {
        // If MATLAB is already connected, return the current connection
        if (this.matlabSession != null) {
            return this.matlabSession.getConnection()
        }

        // If MATLAB is actively connecting, wait for the connection to be established
        if (this.connectionPromise != null) {
            return new Promise<MatlabConnection | null>(resolve => {
                this.connectionPromise!.then(matlabSession => {
                    resolve(matlabSession.getConnection())
                }).catch(() => {
                    resolve(null)
                })
            })
        }

        // No connection currently established or establishing. Attempt to connect to MATLAB if desired.
        if (startMatlab) {
            try {
                const matlabSession = await this.connectToMatlab()
                return matlabSession.getConnection()
            } catch (err) {
                return null
            }
        } else {
            return null
        }
    }

    /**
     * Attempt to connect to MATLAB. This will not create a second connection to MATLAB
     * if a session already exists.
     * 
     * @returns The active MATLAB session
     */
    async connectToMatlab (): Promise<MatlabSession> {
        // If MATLAB is already connected, do not try to connect again
        if (this.matlabSession != null) {
            return this.matlabSession
        }

        // If MATLAB is actively connecting, wait and return that session
        if (this.connectionPromise != null) {
            // MATLAB is actively connecting
            return new Promise<MatlabSession>((resolve, reject) => {
                this.connectionPromise!.then(matlabSession => {
                    resolve(matlabSession)
                }).catch(reason => {
                    reject(reason)
                })
            })
        }

        // Start a new session
        if (shouldConnectToRemoteMatlab()) {
            return this.connectToRemoteMatlab()
        } else {
            return this.connectToLocalMatlab()
        }
    }

    /**
     * Terminate the current MATLAB session.
     * 
     * Emits a 'disconnected' event.
     */
    disconnectFromMatlab (): void {
        if (this.matlabSession == null) {
            return
        }

        this.matlabSession.shutdown()
        this.matlabSession = null

        this.eventEmitter.emit('disconnected')
    }

    /**
     * Determine if MATLAB is connected.
     *
     * @returns True if there is an active MATLAB session, false otherwise
     */
    isMatlabConnected (): boolean {
        return this.matlabSession != null || this.connectionPromise != null
    }

    /**
     * Gets the release of the currently connected MATLAB.
     *
     * @returns The MATLAB release (e.g. "R2023b") of the active session, or null if unknown
     */
    getMatlabRelease (): string | null {
        return this.matlabSession == null ? null : this.matlabSession.getMatlabRelease()
    }

    /**
     * Starts a new session with a locally installed MATLAB instance.
     *
     * @returns The new MATLAB session
     */
    private async connectToLocalMatlab (): Promise<MatlabSession> {
        this.connectionPromise = launchNewMatlab()

        return new Promise<MatlabSession>((resolve, reject) => {
            this.connectionPromise?.then(matlabSession => {
                this.matlabSession = matlabSession
                this.matlabSession.eventEmitter.on('shutdown', () => {
                    this.matlabSession = null
                    this.eventEmitter.emit('disconnected')
                })
                this.eventEmitter.emit('connected')
                resolve(matlabSession)
            }).catch(reason => {
                reject(reason)
            }).finally(() => {
                this.connectionPromise = null
            })
        })
    }

    /**
     * Starts a new session with a MATLAB instance over a URL.
     *
     * @returns The new MATLAB session
     */
    private async connectToRemoteMatlab (): Promise<MatlabSession> {
        const url = ConfigurationManager.getArgument(Argument.MatlabUrl)
        this.connectionPromise = connectToMatlab(url)

        return new Promise<MatlabSession>((resolve, reject) => {
            this.connectionPromise?.then(matlabSession => {
                this.matlabSession = matlabSession
                this.matlabSession.eventEmitter.on('shutdown', () => {
                    this.matlabSession = null
                    this.eventEmitter.emit('disconnected')
                })
                this.eventEmitter.emit('connected')
                resolve(matlabSession)
            }).catch(reason => {
                reject(reason)
            }).finally(() => {
                this.connectionPromise = null
            })
        })
    }
}

/**
 * Whether or not the language server should attempt to connect to an existing
 * MATLAB instance.
 *
 * @returns True if the language server should attempt to connect to an
 * already-running instance of MATLAB. False otherwise.
 */
function shouldConnectToRemoteMatlab (): boolean {
    // Assume we should connect to existing MATLAB if the matlabUrl startup flag has been provided
    return Boolean(ConfigurationManager.getArgument(Argument.MatlabUrl))
}

export default new MatlabLifecycleManager()
