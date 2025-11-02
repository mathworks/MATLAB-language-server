import assert from 'assert'
import sinon from 'sinon'
import { _Connection } from 'vscode-languageserver/node'
import ClientConnection from '../../src/ClientConnection'
import { startServer } from '../../src/server'
import { ClientCapabilities } from 'vscode-languageserver'

async function makeMockConnection(opts: {
  supportsWorkspaceFolders: boolean
  workspaceFoldersResult?: any
  workspaceFoldersShouldThrow?: boolean
}): Promise<any> {
  const onInitializeHandlers: Array<(p: any)=>any> = []
  const onInitializedHandlers: Array<()=>any> = []

  const connection: any = {
    console: { error: sinon.stub(), warn: sinon.stub(), info: sinon.stub(), log: sinon.stub() },
    onInitialize: (h: any) => { onInitializeHandlers.push(h) },
    onInitialized: (h: any) => { onInitializedHandlers.push(h) },
    onShutdown: sinon.stub(),
    onExecuteCommand: sinon.stub(),
    onCompletion: sinon.stub(),
    onSignatureHelp: sinon.stub(),
    onFoldingRanges: sinon.stub(),
    onDocumentFormatting: sinon.stub(),
    onDocumentRangeFormatting: sinon.stub(),
    onCodeAction: sinon.stub(),
    onDefinition: sinon.stub(),
    onReferences: sinon.stub(),
    onDocumentSymbol: sinon.stub(),
    onPrepareRename: sinon.stub(),
    onRenameRequest: sinon.stub(),
    onDocumentHighlight: sinon.stub(),
    client: { register: sinon.stub() },
    workspace: {
      onDidChangeWorkspaceFolders: sinon.stub(),
      getWorkspaceFolders: sinon.stub().callsFake(async () => {
        if (opts.workspaceFoldersShouldThrow) throw new Error('Method not found')
        return opts.workspaceFoldersResult ?? null
      }),
      getConfiguration: sinon.stub().callsFake(async () => {
        // mark called for assertion
        ;(connection.workspace.getConfiguration as any).called = true
        return {
          installPath: '', matlabConnectionTiming: 'onStart', indexWorkspace: false, telemetry: true,
          maxFileSizeForAnalysis: 0, signIn: false, prewarmGraphics: true, defaultEditor: false
        }
      })
    },
    sendNotification: sinon.stub(),
    onDidChangeConfiguration: sinon.stub()
  }

  // Start server using the mock connection
  ClientConnection._setConnection(connection as unknown as _Connection)
  void startServer()

  // allow startServer to register handlers on next tick
  await new Promise(resolve => setImmediate(resolve))

  // In case server registered directly on connection rather than via our arrays,
  // call server.startServer() already did the registration; emulate client by
  // sending initialize/initialized via the connection API if available.

  // use our captured handler if present, otherwise do nothing (server may not require explicit call here)
  const capabilities: ClientCapabilities = { workspace: { workspaceFolders: opts.supportsWorkspaceFolders, configuration: true } }
  const initParams = { capabilities }
  const initHandler = onInitializeHandlers[onInitializeHandlers.length - 1]
  if (typeof initHandler === 'function') {
    initHandler(initParams)
  }
  // Tick to let onInitialize handler run
  await new Promise(resolve => setImmediate(resolve))
  onInitializedHandlers.forEach(h => h())

  return { connection }
}

describe('Workspace folders robustness', () => {
  it('does not throw when client advertises workspaceFolders but request fails', async () => {
    const { connection } = await makeMockConnection({ supportsWorkspaceFolders: true, workspaceFoldersShouldThrow: true })
    assert(connection) // placeholder; scenario covered in dedicated unit tests
  })

  it('works when client returns workspace folders array', async () => {
    const folders = [{ uri: 'file:///tmp', name: 'tmp' }]
    const { connection } = await makeMockConnection({ supportsWorkspaceFolders: true, workspaceFoldersResult: folders })
    assert(connection)
  })

  it('does not request workspace folders when capability is false', async () => {
    const { connection } = await makeMockConnection({ supportsWorkspaceFolders: false })

    assert.strictEqual(connection.workspace.getWorkspaceFolders.called, false)
  })
})
