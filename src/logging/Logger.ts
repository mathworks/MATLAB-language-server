// Copyright 2022 - 2024 The MathWorks, Inc.

import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { RemoteConsole } from 'vscode-languageserver'
import ClientConnection from '../ClientConnection'

const SERVER_LOG = 'languageServerLog.txt'
const MATLAB_LOG = 'matlabLog.txt'

class Logger {
    private static instance: Logger

    public readonly logDir: string
    private readonly languageServerLogFile: string
    private readonly matlabLogFile: string

    private console?: RemoteConsole

    constructor () {
        // Create Log Directory
        const pid = process.pid
        this.logDir = path.join(os.tmpdir(), `matlabls_${pid}`)
        if (fs.existsSync(this.logDir)) {
            let i = 1
            while (fs.existsSync(`${this.logDir}_${i}`)) { i++ }
            this.logDir = `${this.logDir}_${i}`
        }
        fs.mkdirSync(this.logDir)

        // Get name of log file
        this.languageServerLogFile = path.join(this.logDir, SERVER_LOG)
        this.matlabLogFile = path.join(this.logDir, MATLAB_LOG)
    }

    public initialize (console: RemoteConsole): void {
        this.console = console
        
        this.log(`Log Directory: ${this.logDir}`)
    }

    public static getInstance (): Logger {
        if (Logger.instance == null) {
            Logger.instance = new Logger()
        }

        return Logger.instance
    }

    /**
     * Logs an informational message to both the console and the log file.
     *
     * @param message The message
     */
    log (message: string): void {
        const msg = `(${getCurrentTimeString()}) matlabls: ${message}`
        this.console?.log(msg)
        this._writeToLogFile(msg, this.languageServerLogFile)
    }

    /**
     * Logs a warning message to both the console and the log file.
     *
     * @param message The warning message
     */
    warn (message: string): void {
        const msg = `(${getCurrentTimeString()}) matlabls - WARNING: ${message}`
        this.console?.warn(msg)
        this._writeToLogFile(msg, this.languageServerLogFile)
    }

    /**
     * Logs an error message to both the console and the log file.
     *
     * @param message The error message
     */
    error (message: string): void {
        const msg = `(${getCurrentTimeString()}) matlabls - ERROR: ${message}`
        this.console?.error(msg)
        this._writeToLogFile(msg, this.languageServerLogFile)
    }

    /**
     * Log MATLAB application output to a log file on disk, separate from
     * the language server logs.
     *
     * @param message The message
     */
    writeMatlabLog (message: string): void {
        this._writeToLogFile(message, this.matlabLogFile)
    }

    private _writeToLogFile (message: string, filePath: string): void {
        // Log to file
        fs.writeFile(
            filePath,
            `${message}\n`,
            { flag: 'a+' },
            err => {
                if (err !== null) {
                    this.console?.error('Failed to write to log file')
                }
            }
        )
    }
}

function getCurrentTimeString (): string {
    const d = new Date()
    const strFormatter = (x: number): string => x.toString().padStart(2, '0')
    return `${strFormatter(d.getHours())}:${strFormatter(d.getMinutes())}:${strFormatter(d.getSeconds())}`
}

export default Logger.getInstance()
