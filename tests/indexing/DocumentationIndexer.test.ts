// Copyright 2026 The MathWorks, Inc.

import assert from 'assert'
import sinon from 'sinon'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { DocumentationIndexer } from '../../src/indexing/DocumentationIndexer'
import ConfigurationManager, { DocumentationIndexTiming } from '../../src/lifecycle/ConfigurationManager'

describe('DocumentationIndexer', () => {
    let indexer: DocumentationIndexer

    beforeEach(() => {
        indexer = new DocumentationIndexer()
    })

    afterEach(() => {
        sinon.restore()
    })

    describe('#isDatabaseReady', () => {
        const testFile = path.join(os.tmpdir(), `test_db_${Date.now()}.db`)

        afterEach(() => {
            if (fs.existsSync(testFile)) {
                fs.unlinkSync(testFile)
            }
        })

        it('should return false if the database file does not exist', () => {
            assert.strictEqual(indexer.isDatabaseReady(testFile), false)
        })

        it('should return false if the database file exists but has size 0', () => {
            fs.writeFileSync(testFile, '')
            assert.strictEqual(indexer.isDatabaseReady(testFile), false)
        })

        it('should return true if the database file exists and is greater than 0 bytes', () => {
            fs.writeFileSync(testFile, 'sample data')
            assert.strictEqual(indexer.isDatabaseReady(testFile), true)
        })
    })

    describe('#startIndexing', () => {
        it('should skip indexing when configured to never index', async () => {
            sinon.stub(ConfigurationManager, 'getConfiguration').resolves({
                installPath: '',
                matlabConnectionTiming: 'never' as any,
                indexWorkspace: false,
                indexDocumentation: DocumentationIndexTiming.Never,
                telemetry: false,
                maxFileSizeForAnalysis: 0,
                signIn: false,
                prewarmGraphics: false,
                defaultEditor: false
            })

            const spawned = await indexer.startIndexing(false)
            assert.strictEqual(spawned, false)
            assert.strictEqual(indexer.isIndexingInProgress(), false)
        })

        it('should skip indexing when configured to onMissing and database is ready', async () => {
            sinon.stub(ConfigurationManager, 'getConfiguration').resolves({
                installPath: '',
                matlabConnectionTiming: 'never' as any,
                indexWorkspace: false,
                indexDocumentation: DocumentationIndexTiming.OnMissing,
                telemetry: false,
                maxFileSizeForAnalysis: 0,
                signIn: false,
                prewarmGraphics: false,
                defaultEditor: false
            })
            sinon.stub(indexer, 'isDatabaseReady').returns(true)

            const spawned = await indexer.startIndexing(false)
            assert.strictEqual(spawned, false)
        })

        it('should return false if script path is not found', async () => {
            sinon.stub(ConfigurationManager, 'getConfiguration').resolves({
                installPath: '',
                matlabConnectionTiming: 'never' as any,
                indexWorkspace: false,
                indexDocumentation: DocumentationIndexTiming.OnMissing,
                telemetry: false,
                maxFileSizeForAnalysis: 0,
                signIn: false,
                prewarmGraphics: false,
                defaultEditor: false
            })
            sinon.stub(indexer, 'isDatabaseReady').returns(false)
            sinon.stub(indexer, 'getIndexerScriptPath').returns(null)

            const spawned = await indexer.startIndexing(false)
            assert.strictEqual(spawned, false)
        })

        it('should not start if indexing is already in progress', async () => {
            sinon.stub(indexer, 'isIndexingInProgress').returns(true)
            const spawned = await indexer.startIndexing(true)
            assert.strictEqual(spawned, false)
        })
    })
})
