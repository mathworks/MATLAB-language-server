#!/usr/bin/env node

// Copyright 2026 The MathWorks, Inc. / Community
// Parallel MATLAB Documentation Indexer for MATLAB Language Server

const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn, execSync } = require('child_process');
const { DatabaseSync } = require('node:sqlite');
const readline = require('readline');

// 1. Detect CPU Cores and Dynamic Workers
const cpuCount = os.cpus().length;
const defaultWorkers = Math.max(1, Math.min(cpuCount - 2, 12));
const workerArg = process.argv.find(a => a.startsWith('--workers='));
const numWorkers = workerArg ? parseInt(workerArg.split('=')[1], 10) : defaultWorkers;

// 2. Detect MATLAB Root Directory
function detectMatlabRoot() {
    if (process.env.MATLAB_INSTALL_PATH && fs.existsSync(process.env.MATLAB_INSTALL_PATH)) {
        return process.env.MATLAB_INSTALL_PATH;
    }
    const defaultMacPath = '/Applications/MATLAB_R2026a.app';
    if (fs.existsSync(defaultMacPath)) {
        return defaultMacPath;
    }
    // Search /Applications for any MATLAB_*.app
    if (os.platform() === 'darwin') {
        const apps = fs.readdirSync('/Applications').filter(f => f.startsWith('MATLAB_') && f.endsWith('.app'));
        if (apps.length > 0) {
            return path.join('/Applications', apps.sort().reverse()[0]);
        }
    }
    try {
        const binPath = execSync('which matlab', { encoding: 'utf8' }).trim();
        const real = fs.realpathSync(binPath);
        return path.resolve(real, '..', '..');
    } catch {
        return null;
    }
}

const matlabRoot = detectMatlabRoot();
if (!matlabRoot) {
    console.error('ERROR: Could not locate MATLAB installation directory.');
    process.exit(1);
}

// 3. Extract Canonical Function Names
const helpXmlPath = path.join(matlabRoot, 'help', 'matlab', 'helpfuncbycat.xml');
if (!fs.existsSync(helpXmlPath)) {
    console.error(`ERROR: Help XML catalog not found at ${helpXmlPath}`);
    process.exit(1);
}

const xmlContent = fs.readFileSync(helpXmlPath, 'utf8');
const nameRegex = /<name>(.*?)<\/name>/g;
const uniqueNames = new Set();
let match;
while ((match = nameRegex.exec(xmlContent)) !== null) {
    const n = match[1].trim();
    if (n && /^[a-zA-Z0-9_]+$/.test(n)) {
        uniqueNames.add(n);
    }
}

const functionList = Array.from(uniqueNames);
const totalFunctions = functionList.length;

// 4. Setup SQLite Database
const dbDir = path.join(os.homedir(), '.cache', 'matlabls');
fs.mkdirSync(dbDir, { recursive: true });
const dbPath = path.join(dbDir, 'matlab_docs.db');

const db = new DatabaseSync(dbPath);
db.exec(`
    CREATE TABLE IF NOT EXISTS docs (
        name TEXT PRIMARY KEY,
        doc TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_name ON docs(name);
`);

// 5. Partition Functions into Chunks
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'matlab_indexer_'));
const workerScriptPath = path.join(__dirname, 'worker.m');
const chunks = Array.from({ length: numWorkers }, () => []);

functionList.forEach((fn, idx) => {
    chunks[idx % numWorkers].push(fn);
});

const isQuiet = process.argv.includes('--quiet') || !process.stdout.isTTY;

if (!isQuiet) {
    console.clear();
    console.log('\x1b[1;36m========================================================================\x1b[0m');
    console.log('\x1b[1;32m       MATLAB Language Server - Parallel Documentation Indexer          \x1b[0m');
    console.log('\x1b[1;36m========================================================================\x1b[0m');
    console.log(` \x1b[1mSystem CPU Cores:\x1b[0m     ${cpuCount} (${os.cpus()[0].model})`);
    console.log(` \x1b[1mAllocated Workers:\x1b[0m    ${numWorkers} parallel workers`);
    console.log(` \x1b[1mMATLAB Path:\x1b[0m          ${matlabRoot}`);
    console.log(` \x1b[1mUnique Functions:\x1b[0m     ${totalFunctions}`);
    console.log(` \x1b[1mSQLite Target:\x1b[0m        ${dbPath}`);
    console.log('\x1b[1;36m------------------------------------------------------------------------\x1b[0m\n');
} else {
    console.log(`[matlabls-indexer] Indexing ${totalFunctions} canonical MATLAB functions into ${dbPath} using ${numWorkers} workers.`);
}

let processedCount = 0;
const startTime = Date.now();
const workerStatus = Array.from({ length: numWorkers }, () => 'Initializing');
const activeWorkers = new Set();

function renderDashboard() {
    if (isQuiet) return;
    const elapsedSec = (Date.now() - startTime) / 1000;
    const speed = elapsedSec > 0 ? (processedCount / elapsedSec) : 0;
    const remaining = totalFunctions - processedCount;
    const etaSec = speed > 0 ? Math.round(remaining / speed) : 0;
    const pct = totalFunctions > 0 ? ((processedCount / totalFunctions) * 100) : 0;

    const barWidth = 36;
    const filledWidth = Math.round((pct / 100) * barWidth);
    const emptyWidth = barWidth - filledWidth;
    const bar = '█'.repeat(filledWidth) + '░'.repeat(emptyWidth);

    readline.cursorTo(process.stdout, 0, 9);
    process.stdout.write(` \x1b[1mProgress:\x1b[0m  [\x1b[32m${bar}\x1b[0m] \x1b[1;33m${pct.toFixed(1)}%\x1b[0m (${processedCount}/${totalFunctions})\n`);
    process.stdout.write(` \x1b[1mMetrics:\x1b[0m   Speed: \x1b[35m${speed.toFixed(1)} func/sec\x1b[0m  |  Elapsed: \x1b[36m${elapsedSec.toFixed(1)}s\x1b[0m  |  ETA: \x1b[33m~${etaSec}s\x1b[0m   \n\n`);

    process.stdout.write(' \x1b[1mWorker Status:\x1b[0m\n');
    for (let i = 0; i < numWorkers; i += 2) {
        const w1 = ` Worker ${String(i + 1).padStart(2)}: \x1b[34m${(workerStatus[i] || '').padEnd(16).substring(0, 16)}\x1b[0m`;
        const w2 = (i + 1 < numWorkers) ? ` Worker ${String(i + 2).padStart(2)}: \x1b[34m${(workerStatus[i + 1] || '').padEnd(16).substring(0, 16)}\x1b[0m` : '';
        process.stdout.write(`${w1}  | ${w2}\n`);
    }
}

// 6. Spawn Workers
const workerPromises = chunks.map((chunk, workerIdx) => {
    return new Promise((resolve) => {
        const workerId = workerIdx + 1;
        const chunkFile = path.join(tmpDir, `chunk_${workerId}.json`);
        const outFile = path.join(tmpDir, `out_${workerId}.jsonl`);
        fs.writeFileSync(chunkFile, JSON.stringify(chunk));

        activeWorkers.add(workerId);
        workerStatus[workerIdx] = 'Starting...';

        const matlabCmd = path.join(matlabRoot, 'bin', 'matlab');
        const scriptDir = path.dirname(workerScriptPath);
        const matlabCode = `addpath('${scriptDir}'); worker('${chunkFile}', '${outFile}', ${workerId});`;

        const child = spawn(matlabCmd, ['-batch', matlabCode], {
            stdio: ['ignore', 'pipe', 'pipe']
        });

        let lineBuffer = '';
        child.stdout.on('data', (chunk) => {
            lineBuffer += chunk.toString();
            const lines = lineBuffer.split('\n');
            lineBuffer = lines.pop(); // keep remainder

            for (const line of lines) {
                const trimmed = line.trim();
                if (trimmed.startsWith('PROG:')) {
                    const parts = trimmed.split(':');
                    const fn = parts[2] || '';
                    processedCount++;
                    workerStatus[workerIdx] = fn;
                    renderDashboard();
                }
            }
        });

        child.on('close', () => {
            activeWorkers.delete(workerId);
            workerStatus[workerIdx] = 'Finished';
            renderDashboard();
            resolve(outFile);
        });

        child.on('error', (err) => {
            workerStatus[workerIdx] = `Error: ${err.message}`;
            activeWorkers.delete(workerId);
            renderDashboard();
            resolve(outFile);
        });
    });
});

// Render initial state
renderDashboard();

// 7. Await Workers and Ingest into SQLite
Promise.all(workerPromises).then((outFiles) => {
    renderDashboard();

    const importStartTime = Date.now();
    console.log('\n\x1b[1;36m------------------------------------------------------------------------\x1b[0m');
    console.log(' \x1b[1;33mWriting documentation records to SQLite database...\x1b[0m');

    const insertStmt = db.prepare('INSERT OR REPLACE INTO docs (name, doc) VALUES (?, ?)');
    db.exec('BEGIN TRANSACTION;');

    let recordCount = 0;
    for (const outFile of outFiles) {
        if (fs.existsSync(outFile)) {
            const lines = fs.readFileSync(outFile, 'utf8').split('\n');
            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed) continue;
                try {
                    const parsed = JSON.parse(trimmed);
                    if (parsed.name && parsed.doc) {
                        insertStmt.run(parsed.name, parsed.doc);
                        recordCount++;
                    }
                } catch {
                    // skip invalid line
                }
            }
        }
    }
    db.exec('COMMIT;');

    // Clean up temporary files
    try {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
        // ignore
    }

    const totalElapsedSec = ((Date.now() - startTime) / 1000).toFixed(1);
    const dbStat = fs.statSync(dbPath);
    const dbSizeMb = (dbStat.size / (1024 * 1024)).toFixed(2);

    if (isQuiet) {
        console.log(`[matlabls-indexer] Indexing complete! ${recordCount} functions indexed in ${totalElapsedSec}s (${dbSizeMb} MB) -> ${dbPath}`);
    } else {
        console.log('\x1b[1;32m✔ Indexing and SQLite insertion complete!\x1b[0m');
        console.log(` \x1b[1mTotal Functions Indexed:\x1b[0m ${recordCount}`);
        console.log(` \x1b[1mDatabase Size:\x1b[0m           ${dbSizeMb} MB`);
        console.log(` \x1b[1mTotal Time Elapsed:\x1b[0m      ${totalElapsedSec} seconds`);
        console.log(` \x1b[1mDatabase File Location:\x1b[0m  ${dbPath}`);
        console.log('\x1b[1;36m========================================================================\x1b[0m');
    }
});
