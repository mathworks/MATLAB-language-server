// Copyright 2026 The MathWorks, Inc.

import { spawn } from 'child_process'
import { EventEmitter } from 'events'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import ConfigurationManager, { DocumentationIndexTiming } from '../lifecycle/ConfigurationManager'
import Logger from '../logging/Logger'

export class DocumentationIndexer {
    private isIndexing = false
    public readonly eventEmitter = new EventEmitter()

    /**
     * Returns whether documentation indexing is currently in progress.
     */
    public isIndexingInProgress (): boolean {
        return this.isIndexing
    }

    /**
     * Gets the path to the local SQLite documentation database.
     */
    public getDatabasePath (): string {
        return path.join(os.homedir(), '.cache', 'matlabls', 'matlab_docs.db')
    }

    /**
     * Checks if the documentation database exists and is populated.
     */
    public isDatabaseReady (targetPath?: string): boolean {
        const dbPath = targetPath ?? this.getDatabasePath()
        try {
            if (fs.existsSync(dbPath)) {
                const stat = fs.statSync(dbPath)
                return stat.size > 0
            }
        } catch {
            return false
        }
        return false
    }

    /**
     * Resolves the location of the indexer script.
     */
    public getIndexerScriptPath (): string | null {
        const candidates = [
            path.resolve(__dirname, '..', '..', 'tools', 'indexer', 'index_docs.js'),
            path.resolve(__dirname, '..', 'tools', 'indexer', 'index_docs.js'),
            path.resolve(__dirname, 'tools', 'indexer', 'index_docs.js'),
            path.resolve(process.cwd(), 'tools', 'indexer', 'index_docs.js')
        ]

        for (const candidate of candidates) {
            if (fs.existsSync(candidate)) {
                return candidate
            }
        }
        return null
    }

    /**
     * Starts background indexing of MATLAB documentation if required by settings or forced.
     *
     * @param force - If true, bypasses configuration and existing database checks.
     * @returns Promise resolving to true if indexing was spawned, false otherwise.
     */
    public async startIndexing (force = false): Promise<boolean> {
        if (this.isIndexingInProgress()) {
            Logger.log('MATLAB documentation indexing is already running.')
            return false
        }

        const configuration = await ConfigurationManager.getConfiguration()

        if (!force) {
            if (configuration.indexDocumentation === DocumentationIndexTiming.Never) {
                Logger.log('Documentation indexing skipped (setting: never).')
                return false
            }

            if (configuration.indexDocumentation === DocumentationIndexTiming.OnMissing && this.isDatabaseReady()) {
                Logger.log('Documentation database already exists. Skipping indexing.')
                return false
            }
        }

        const scriptPath = this.getIndexerScriptPath()
        if (scriptPath == null) {
            Logger.warn('MATLAB documentation indexer script (index_docs.js) was not found.')
            return false
        }

        const env = { ...process.env }
        if (configuration.installPath !== '' && configuration.installPath.trim() !== '') {
            env.MATLAB_INSTALL_PATH = configuration.installPath.trim()
        }

        Logger.log(`Spawning background documentation indexer: ${scriptPath}`)
        this.isIndexing = true

        const child = spawn(process.execPath, [scriptPath, '--quiet'], {
            env,
            stdio: ['ignore', 'pipe', 'pipe']
        })

        child.stdout?.on('data', (chunk: Buffer) => {
            const msg = chunk.toString().trim()
            if (msg.length > 0) {
                Logger.log(`[Indexer] ${msg}`)
            }
        })

        child.stderr?.on('data', (chunk: Buffer) => {
            const msg = chunk.toString().trim()
            if (msg.length > 0) {
                Logger.warn(`[Indexer] ${msg}`)
            }
        })

        child.on('close', (code: number | null) => {
            this.isIndexing = false
            if (code === 0) {
                Logger.log('MATLAB documentation indexing completed successfully.')
                this.eventEmitter.emit('indexed')
            } else {
                Logger.warn(`MATLAB documentation indexer exited with code ${code ?? 'unknown'}`)
            }
        })

        child.on('error', (err: Error) => {
            this.isIndexing = false
            Logger.error(`Failed to execute MATLAB documentation indexer: ${err.message}`)
        })

        return true
    }
}

export default new DocumentationIndexer()
