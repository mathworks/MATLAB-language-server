// Copyright 2024 The MathWorks, Inc.

import { ChildProcess } from "child_process";
import Logger from "../logging/Logger";
import { Actions, reportTelemetryAction } from "../logging/TelemetryUtils";
import NotificationService, { Notification } from "../notifications/NotificationService";
import ConfigurationManager, { Argument } from "./ConfigurationManager";
import LifecycleNotificationHelper from "./LifecycleNotificationHelper";
import MatlabCommunicationManager, { LifecycleEventType, MatlabConnection } from "./MatlabCommunicationManager";

import * as chokidar from 'chokidar'
import * as fsPromises from 'fs/promises'
import * as os from 'os'
import * as path from 'path'
import { EventEmitter } from 'events'

interface MatlabStartupInfo {
    pid: number
    port: number
    release: string
    certFile: string
    sessionKey: string
}

export enum ConnectionState {
    CONNECTING = 'connecting',
    CONNECTED = 'connected',
    DISCONNECTED = 'disconnected'
}

/**
 * Launches and connects to a new MATLAB instance.
 *
 * @returns The MATLAB session
 */
export async function launchNewMatlab (): Promise<MatlabSession> {
    LifecycleNotificationHelper.didMatlabLaunchFail = false
    LifecycleNotificationHelper.notifyConnectionStatusChange(ConnectionState.CONNECTING)

    const matlabSession = new LocalMatlabSession()

    return await new Promise<MatlabSession>(async (resolve, reject) => {
        // Setup file watch for MATLAB starting
        const outFile = path.join(Logger.logDir, 'matlabls_conn.json')

        const watcher = chokidar.watch(outFile, {
            persistent: true,
            useFsEvents: false
        })

        // This callback will be triggered when MATLAB has launched and writes the watched file.
        watcher.on('add', async () => {
            Logger.log(`Started MATLAB (session ${matlabSession.sessionId})`)

            // First change detected - close watcher
            watcher.close()

            // Read startup info from file
            const connectionInfo = await readStartupInfo(outFile)
            const { pid, release, port, certFile, sessionKey } = connectionInfo

            matlabSession.startConnection(port, certFile, pid, release).then(() => {
                LifecycleNotificationHelper.notifyConnectionStatusChange(ConnectionState.CONNECTED)
                Logger.log(`MATLAB session ${matlabSession.sessionId} connected to ${release}`)
                reportTelemetryAction(Actions.StartMatlab, release)
                reportTelemetryAction(Actions.MatlabSessionKey, sessionKey)
                resolve(matlabSession as MatlabSession)
            }).catch(reason => {
                Logger.error(`MATLAB session ${matlabSession.sessionId} failed to connect`)
                matlabSession.shutdown()
                reportTelemetryAction(Actions.StartMatlab, 'Failed to connect to MATLAB')
                reject(reason)
            })

            // outFile is no longer needed - delete
            void fsPromises.rm(outFile, { force: true })
        })

        // Launch MATLAB process
        Logger.log('Launching MATLAB...')
        const { command, args } = await getMatlabLaunchCommand(outFile)
        const matlabProcessInfo = MatlabCommunicationManager.launchNewMatlab(command, args, Logger.logDir)

        if (matlabProcessInfo == null) {
            // Error occurred while spawning MATLAB process
            matlabSession.shutdown('Error spawning MATLAB process')
            watcher.close()

            Logger.error(`Error launching MATLAB with command: ${command}`)

            LifecycleNotificationHelper.didMatlabLaunchFail = true
            NotificationService.sendNotification(Notification.MatlabLaunchFailed)

            reject('Failed to launch local MATLAB')
            return
        }

        // Initialize the new session
        const { matlabConnection, matlabProcess } = matlabProcessInfo
        matlabSession.initialize(matlabConnection, matlabProcess)

        // Handles additional errors with launching the MATLAB process
        matlabProcess?.on('error', error => {
            // Error occurred in child process
            matlabSession.shutdown('Error launching MATLAB')
            watcher.close()

            Logger.error(`Error launching MATLAB: (${error.name}) ${error.message}`)
            if (error.stack != null) {
                Logger.error(`Error stack:\n${error.stack}`)
            }

            LifecycleNotificationHelper.didMatlabLaunchFail = true
            NotificationService.sendNotification(Notification.MatlabLaunchFailed)

            reject('Error from MATLAB child process')
        })
    })
}

/**
 * Connects to a MATLAB instance over the given URL.
 *
 * @param url The URL at which to find MATLAB
 *
 * @returns The MATLAB session
 */
export async function connectToMatlab (url: string): Promise<MatlabSession> {
    LifecycleNotificationHelper.notifyConnectionStatusChange(ConnectionState.CONNECTING)

    const matlabSession = new RemoteMatlabSession()

    const matlabConnection = await MatlabCommunicationManager.connectToExistingMatlab(url)
    matlabSession.initialize(matlabConnection)

    await matlabSession.startConnection()
    return matlabSession
}

/**
 * Represents an active session with MATLAB
 */
export default interface MatlabSession {
    /**
     * The ID of the current session. This is unique across all sessions 
     * in the lifetime of the language server.
     */
    sessionId: number

    /**
     * Emits events for the session.
     * 
     * Will emit a "shutdown" event when the session is terminated. 
     */
    eventEmitter: EventEmitter

    /**
     * Instantiates the connection with MATLAB.
     * 
     * @param args See {@link LocalMatlabSession#startConnection} and ${@link RemoteMatlabSession#startConnection}
     * for specific details.
     */
    startConnection: (...args: unknown[]) => Promise<void>

    /**
     * Gets the connection with MATLAB.
     *
     * @returns The connection with MATLAB, or null if no current connection exists
     */
    getConnection: () => MatlabConnection | null

    /**
     * Gets the release of the connected MATLAB.
     *
     * @returns the MATLAB release (e.g. "R2023b") or null if unknown
     */
    getMatlabRelease: () => string | null

    /**
     * Terminates the session
     */
    shutdown: () => void
}

let sessionIdCt = 1;

abstract class AbstractMatlabSession implements MatlabSession {
    sessionId = sessionIdCt++
    eventEmitter = new EventEmitter()

    protected matlabConnection?: MatlabConnection
    protected matlabRelease?: string

    protected isValid = true

    getConnection (): MatlabConnection | null {
        return this.matlabConnection ?? null
    }

    getMatlabRelease (): string | null {
        return this.matlabRelease ?? null
    }

    abstract startConnection (...args: unknown[]): Promise<void>

    abstract shutdown (): void

    protected notifyConnectionStatusChange (status: ConnectionState): void {
        if (this.isValid) {
            // Only sent notifications about status changes for valid
            // sessions, to avoid potential poor interactions between
            // a session shutting down and a new session starting.
            LifecycleNotificationHelper.notifyConnectionStatusChange(status)
        }
    }
}

/**
 * Represents a session with a locally installed MATLAB.
 */
class LocalMatlabSession extends AbstractMatlabSession {
    private matlabProcess?: ChildProcess
    private matlabPid?: number

    initialize (matlabConnection: MatlabConnection, matlabProcess: ChildProcess): void {
        this.matlabConnection = matlabConnection
        this.matlabProcess = matlabProcess

        this.setupListeners()
    }

    /**
     * Instantiates the connection with MATLAB.
     *
     * @param port MATLAB's secure port number
     * @param certFile The file location for MATLAB's self-signed certificate
     * @param matlabPid MATLAB's process ID
     * @param matlabRelease The MATLAB release
     */
    async startConnection (port: number, certFile: string, matlabPid: number, matlabRelease: string): Promise<void> {
        this.matlabPid = matlabPid
        this.matlabRelease = matlabRelease

        if (this.matlabConnection == null) {
            Logger.error('Attempting to start connection to MATLAB without first initializing')
            return Promise.reject('LocalMatlabSession not initialized')
        }

        return this.matlabConnection.initialize(port, certFile)
    }

    shutdown (shutdownMessage?: string): void {
        if (!this.isValid) {
            // Don't attempt to shut down more than once
            return
        }

        Logger.log(`Shutting down MATLAB session ${this.sessionId}`)

        // Report shutdown
        this.notifyConnectionStatusChange(ConnectionState.DISCONNECTED)
        reportTelemetryAction(Actions.ShutdownMatlab, shutdownMessage)
        this.eventEmitter.emit('shutdown')

        this.isValid = false;

        // Close the connection and kill MATLAB process
        if (os.platform() === 'win32' && this.matlabPid != null) {
            // Need to kill MATLAB's child process which is launched on Windows
            process.kill(this.matlabPid, 'SIGTERM')
        }
        this.matlabConnection?.close()
        this.matlabProcess?.kill('SIGTERM')
    }

    private setupListeners (): void {
        // Handle messages from MATLAB's standard err channel. Because MATLAB is launched
        // with the -log flag, all of MATLAB's output is pushed through stderr. Write this
        // to a log file
        this.matlabProcess?.stderr?.on('data', data => {
            const stderrStr: string = data.toString().trim()
            Logger.writeMatlabLog(stderrStr)
        })
        
        // Handles the MATLAB process being terminated unexpectedly/externally.
        // This could include the user killing the process.
        this.matlabProcess?.on('close', () => {
            // Close connection
            Logger.log(`MATLAB process (session ${this.sessionId}) terminated`)
            this.shutdown()
        })

        // Set up lifecycle listener
        this.matlabConnection?.setLifecycleListener(lifecycleEvent => {
            if (lifecycleEvent === LifecycleEventType.DISCONNECTED) {
                Logger.warn('Error while communicating with MATLAB - disconnecting')
                this.shutdown('Error while communicating with MATLAB')
            }
        })
    }
}

/**
 * Represents a session with a (potentially) remote MATLAB instance over a URL.
 */
class RemoteMatlabSession extends AbstractMatlabSession {
    initialize (matlabConnection: MatlabConnection): void {
        this.matlabConnection = matlabConnection

        this.setupListeners()
    }

    /**
     * Instantiates the connection with MATLAB.
     */
    async startConnection (): Promise<void> {
        if (this.matlabConnection == null) {
            Logger.error('Attempting to start connection to MATLAB without first initializing')
            return Promise.reject('RemoteMatlabSession not initialized')
        }

        return this.matlabConnection?.initialize()
    }

    shutdown(shutdownMessage?: string): void {
        if (!this.isValid) {
            // Don't attempt to shut down more than once
            return
        }

        // Report shutdown
        this.notifyConnectionStatusChange(ConnectionState.DISCONNECTED)
        reportTelemetryAction(Actions.ShutdownMatlab, shutdownMessage)
        this.eventEmitter.emit('shutdown')

        this.isValid = false

        // Close the connection
        this.matlabConnection?.close()
    }

    private setupListeners (): void {
        this.matlabConnection?.setLifecycleListener(lifecycleEvent => {
            if (lifecycleEvent === LifecycleEventType.CONNECTED) {
                this.notifyConnectionStatusChange(ConnectionState.CONNECTED)
            } else if (lifecycleEvent === LifecycleEventType.DISCONNECTED) {
                this.shutdown('Remote MATLAB disconnected')
            }
        })
    }
}

/**
 * Reads the startup info generated by MATLAB when it is launched.
 *
 * @param file The file from which to read
 * @returns The MATLAB startup info
 */
async function readStartupInfo (file: string): Promise<MatlabStartupInfo> {
    const data = await fsPromises.readFile(file)
    return JSON.parse(data.toString()) as MatlabStartupInfo
}

/**
 * Gets the command with which MATLAB should be launched.
 *
 * @param outFile The file in which MATLAB should output connection details
 * @returns The MATLAB launch command and arguments
 */
async function getMatlabLaunchCommand (outFile: string): Promise<{ command: string, args: string[] }> {
    const matlabInstallPath = (await ConfigurationManager.getConfiguration()).installPath
    let command = 'matlab'
    if (matlabInstallPath !== '') {
        command = path.normalize(path.join(
            matlabInstallPath,
            'bin',
            'matlab'
        ))
    }

    const args = [
        '-log',
        '-memmgr', 'release', // Memory manager
        '-noAppIcon', // Hide MATLAB application icon in taskbar/dock, if applicable
        '-nosplash', // Hide splash screen
        '-r', `addpath(fullfile('${__dirname}', '..', 'matlab')); initmatlabls('${outFile}')`, // Startup command
        '-useStartupFolderPref', // Startup folder flag
        '-nodesktop' // Hide the MATLAB desktop
    ]

    if (os.platform() === 'win32') {
        args.push('-noDisplayDesktop') // Workaround for '-nodesktop' on Windows until a better solution is implemented
        args.push('-wait')
    }

    const argsFromSettings = ConfigurationManager.getArgument(Argument.MatlabLaunchCommandArguments) ?? null
    if (argsFromSettings != null) {
        args.push(argsFromSettings)
    }

    return {
        command,
        args
    }
}
