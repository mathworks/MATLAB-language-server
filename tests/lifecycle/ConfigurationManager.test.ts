// Copyright 2025 The MathWorks, Inc.
import assert from 'assert'
import sinon from 'sinon'

import ClientConnection from '../../src/ClientConnection'
import ConfigurationManager from '../../src/lifecycle/ConfigurationManager'
import { DidChangeConfigurationNotification } from 'vscode-languageserver'

function makeMockConnection() {
  const register = sinon.stub()
  const getConfiguration = sinon.stub().resolves({})
  const onDidChangeConfiguration = sinon.stub()
  const mock: any = {
    client: { register },
    workspace: { getConfiguration },
    onDidChangeConfiguration,
    console: { error: sinon.stub(), warn: sinon.stub(), info: sinon.stub(), log: sinon.stub() },
  }
  return { mock, stubs: { register, getConfiguration, onDidChangeConfiguration } }
}

describe('ConfigurationManager.setup', () => {
  afterEach(() => {
    sinon.restore()
    ClientConnection._clearConnection()
  })

  it('does not register didChangeConfiguration when dynamicRegistration is false/undefined', () => {
    const { mock, stubs } = makeMockConnection()
    ClientConnection._setConnection(mock)

    const capabilities: any = { workspace: { configuration: true } }
    ConfigurationManager.setup(capabilities)

    assert.equal(stubs.register.called, false, 'client.register should not be called')
  })

  it('registers didChangeConfiguration when dynamicRegistration is true', () => {
    const { mock, stubs } = makeMockConnection()
    ClientConnection._setConnection(mock)

    const capabilities: any = { workspace: { configuration: true, didChangeConfiguration: { dynamicRegistration: true } } }
    ConfigurationManager.setup(capabilities)

    assert.equal(stubs.register.calledOnce, true, 'client.register should be called once')
    const arg = stubs.register.getCall(0).args[0]
    assert.equal(arg, DidChangeConfigurationNotification.type, 'should register DidChangeConfigurationNotification')
  })

  it('swallows registration errors (no unhandledRejection)', async () => {
    const { mock, stubs } = makeMockConnection()
    // Cause register to reject
    stubs.register.rejects(new Error('Unhandled method client/registerCapability'))
    ClientConnection._setConnection(mock)

    let unhandled = 0
    const handler = () => {
      unhandled++
    }
    process.on('unhandledRejection', handler)

    try {
      const capabilities: any = { workspace: { configuration: true, didChangeConfiguration: { dynamicRegistration: true } } }
      ConfigurationManager.setup(capabilities)
      // allow microtasks to run
      await new Promise((r) => setTimeout(r, 0))
      assert.equal(unhandled, 0, 'should not emit unhandledRejection')
    } finally {
      process.off('unhandledRejection', handler)
    }
  })

  it('requests configuration when workspace.configuration is true', async () => {
    const { mock, stubs } = makeMockConnection()
    stubs.getConfiguration.resolves({ installPath: '/opt/matlab', telemetry: false })
    ClientConnection._setConnection(mock)

    const capabilities: any = { workspace: { configuration: true } }
    ConfigurationManager.setup(capabilities)

    const cfg = await ConfigurationManager.getConfiguration()
    assert.ok(stubs.getConfiguration.calledOnce, 'workspace.getConfiguration should be called')
    assert.equal(typeof cfg, 'object')
  })
})
