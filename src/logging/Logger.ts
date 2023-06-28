// Copyright 2022 - 2023 The MathWorks, Inc.

import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { RemoteConsole } from 'vscode-languageserver'

const SERVER_LOG = 'languageServerLog.txt'
const MATLAB_LOG = 'matlabLog.txt'

class Logger {
    private readonly _logDir: string
    private readonly languageServerLogFile: string
    private readonly matlabLogFile: string
    private _console: RemoteConsole | null = null

    constructor () {
        // Create Log Directory
        const pid = process.pid
        this._logDir = path.join(os.tmpdir(), `matlabls_${pid}`)
        if (fs.existsSync(this._logDir)) {
            let i = 1
            while (fs.existsSync(`${this._logDir}_${i}`)) { i++ }
            this._logDir = `${this._logDir}_${i}`
        }
        fs.mkdirSync(this._logDir)

        // Get name of log file
        this.languageServerLogFile = path.join(this._logDir, SERVER_LOG)
        this.matlabLogFile = path.join(this._logDir, MATLAB_LOG)
    }

    /**
     * Initializes the logger with an output console.
     *
     * @param console The console which the Logger should output to
     */
    initialize (console: RemoteConsole): void {
        this._console = console
        this.log(`Log Directory: ${this._logDir}`)
    }

    /**
     * Logs an informational message to both the console and the log file.
     *
     * @param message The message
     */
    log (message: string): void {
        const msg = `(${getCurrentTimeString()}) matlabls: ${message}`
        this._console?.log(msg)
        this._writeToLogFile(msg, this.languageServerLogFile)
    }

    /**
     * Logs a warning message to both the console and the log file.
     *
     * @param message The warning message
     */
    warn (message: string): void {
        const msg = `(${getCurrentTimeString()}) matlabls - WARNING: ${message}`
        this._console?.warn(msg)
        this._writeToLogFile(msg, this.languageServerLogFile)
    }

    /**
     * Logs an error message to both the console and the log file.
     *
     * @param message The error message
     */
    error (message: string): void {
        const msg = `(${getCurrentTimeString()}) matlabls - ERROR: ${message}`
        this._console?.error(msg)
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

    public get logDir (): string {
        return this._logDir
    }

    private _writeToLogFile (message: string, filePath: string): void {
        // Log to file
        fs.writeFile(
            filePath,
            `${message}\n`,
            { flag: 'a+' },
            err => {
                if (err !== null) {
                    this._console?.error('Failed to write to log file')
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

export default new Logger()
