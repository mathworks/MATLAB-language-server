// Copyright 2026 The MathWorks, Inc.
import assert from 'assert'
import { ClientCapabilities } from 'vscode-languageserver'

import ClientCapabilitiesManager from '../../src/lifecycle/ClientCapabilitiesManager'

describe('ClientCapabilitiesManager', () => {
    afterEach(() => {
        // Reset to uninitialized state between tests
        ClientCapabilitiesManager.initialize(null as unknown as ClientCapabilities)
    })

    describe('initialize', () => {
        it('should make capabilities available after initialization', () => {
            ClientCapabilitiesManager.initialize({
                workspace: { workspaceFolders: true }
            })

            assert.strictEqual(ClientCapabilitiesManager.hasWorkspaceFolders(), true)
        })

        it('should allow re-initialization with new capabilities', () => {
            ClientCapabilitiesManager.initialize({ workspace: { workspaceFolders: true } })
            ClientCapabilitiesManager.initialize({ workspace: { workspaceFolders: false } })

            assert.strictEqual(ClientCapabilitiesManager.hasWorkspaceFolders(), false)
        })
    })

    describe('hasWorkspaceConfiguration', () => {
        it('should return true when workspace.configuration is present', () => {
            ClientCapabilitiesManager.initialize({
                workspace: { configuration: true }
            })

            assert.strictEqual(ClientCapabilitiesManager.hasWorkspaceConfiguration(), true)
        })

        it('should return false when workspace.configuration is not present', () => {
            ClientCapabilitiesManager.initialize({
                workspace: {}
            })

            assert.strictEqual(ClientCapabilitiesManager.hasWorkspaceConfiguration(), false)
        })

        it('should return false when workspace is not present', () => {
            ClientCapabilitiesManager.initialize({})

            assert.strictEqual(ClientCapabilitiesManager.hasWorkspaceConfiguration(), false)
        })

        it('should return false when not initialized', () => {
            assert.strictEqual(ClientCapabilitiesManager.hasWorkspaceConfiguration(), false)
        })
    })

    describe('hasDynamicConfigurationRegistration', () => {
        it('should return true when dynamicRegistration is true', () => {
            ClientCapabilitiesManager.initialize({
                workspace: {
                    didChangeConfiguration: { dynamicRegistration: true }
                }
            })

            assert.strictEqual(ClientCapabilitiesManager.hasDynamicConfigurationRegistration(), true)
        })

        it('should return false when dynamicRegistration is false', () => {
            ClientCapabilitiesManager.initialize({
                workspace: {
                    didChangeConfiguration: { dynamicRegistration: false }
                }
            })

            assert.strictEqual(ClientCapabilitiesManager.hasDynamicConfigurationRegistration(), false)
        })

        it('should return false when didChangeConfiguration is not present', () => {
            ClientCapabilitiesManager.initialize({
                workspace: {}
            })

            assert.strictEqual(ClientCapabilitiesManager.hasDynamicConfigurationRegistration(), false)
        })

        it('should return false when not initialized', () => {
            assert.strictEqual(ClientCapabilitiesManager.hasDynamicConfigurationRegistration(), false)
        })
    })

    describe('hasWorkspaceFolders', () => {
        it('should return true when workspaceFolders is true', () => {
            ClientCapabilitiesManager.initialize({
                workspace: { workspaceFolders: true }
            })

            assert.strictEqual(ClientCapabilitiesManager.hasWorkspaceFolders(), true)
        })

        it('should return false when workspaceFolders is false', () => {
            ClientCapabilitiesManager.initialize({
                workspace: { workspaceFolders: false }
            })

            assert.strictEqual(ClientCapabilitiesManager.hasWorkspaceFolders(), false)
        })

        it('should return false when workspaceFolders is not present', () => {
            ClientCapabilitiesManager.initialize({
                workspace: {}
            })

            assert.strictEqual(ClientCapabilitiesManager.hasWorkspaceFolders(), false)
        })

        it('should return false when not initialized', () => {
            assert.strictEqual(ClientCapabilitiesManager.hasWorkspaceFolders(), false)
        })
    })

    describe('hasSemanticTokensRefresh', () => {
        it('should return true when refreshSupport is true', () => {
            ClientCapabilitiesManager.initialize({
                workspace: {
                    semanticTokens: { refreshSupport: true }
                }
            })

            assert.strictEqual(ClientCapabilitiesManager.hasSemanticTokensRefresh(), true)
        })

        it('should return false when refreshSupport is false', () => {
            ClientCapabilitiesManager.initialize({
                workspace: {
                    semanticTokens: { refreshSupport: false }
                }
            })

            assert.strictEqual(ClientCapabilitiesManager.hasSemanticTokensRefresh(), false)
        })

        it('should return false when semanticTokens is not present', () => {
            ClientCapabilitiesManager.initialize({
                workspace: {}
            })

            assert.strictEqual(ClientCapabilitiesManager.hasSemanticTokensRefresh(), false)
        })

        it('should return false when not initialized', () => {
            assert.strictEqual(ClientCapabilitiesManager.hasSemanticTokensRefresh(), false)
        })
    })
})
