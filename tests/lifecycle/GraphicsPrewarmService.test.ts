// Copyright 2025 The MathWorks, Inc.
import assert from 'assert'
import sinon from 'sinon'

import getMockMvm from '../mocks/Mvm.mock'
import getMockConfigurationManager from '../mocks/ConfigurationManager.mock'

import { IMVM, MatlabState } from '../../src/mvm/impl/MVM'

import GraphicsPrewarmService from '../../src/lifecycle/GraphicsPrewarmService'

describe('GraphicsPrewarmService', () => {
    let mockMvm: any
    let mockConfigurationManager: any

    beforeEach(() => {
        mockMvm = getMockMvm()
        mockConfigurationManager = getMockConfigurationManager()
    })
    
    afterEach(() => {
        sinon.restore()
    })

    it('should prewarm when enabled and MVM connects to valid release', async () => {
        mockConfigurationManager.getConfiguration.resolves({ prewarmGraphics: true})
        mockMvm.getMatlabRelease.returns('R2025a')

        const graphicsPrewarmService = new GraphicsPrewarmService(mockMvm, mockConfigurationManager)
        assert.ok(!graphicsPrewarmService.hasPrewarmed, 'Should not have prewarmed yet')
        
        mockMvm._emitEvent(IMVM.Events.stateChange, MatlabState.READY)

        // Wait for async operations to resolve
        await new Promise(resolve => setTimeout(resolve, 0))

        sinon.assert.calledOnce(mockMvm.feval)
        sinon.assert.calledWith(mockMvm.feval, 'matlab.desktop.internal.webdesktop', 0, ['-hidden']);
        assert.ok(graphicsPrewarmService.hasPrewarmed, 'Should have prewarmed after MVM READY event')
    })

    it('should prewarm on settings change', async () => {
        mockConfigurationManager.getConfiguration.resolves({ prewarmGraphics: false })
        mockMvm.getMatlabRelease.returns('R2025a')

        const graphicsPrewarmService = new GraphicsPrewarmService(mockMvm, mockConfigurationManager)
        assert.ok(!graphicsPrewarmService.hasPrewarmed, 'Should not have prewarmed yet')

        mockMvm._emitEvent(IMVM.Events.stateChange, MatlabState.READY)

        sinon.assert.notCalled(mockMvm.feval)
        assert.ok(!graphicsPrewarmService.hasPrewarmed, 'Still should not have prewarmed because setting is disabled')

        mockConfigurationManager._triggerSettingCallback('prewarmGraphics', { prewarmGraphics: true })

        // Wait for async operations to resolve
        await new Promise(resolve => setTimeout(resolve, 0))
        
        sinon.assert.calledOnce(mockMvm.feval)
        sinon.assert.calledWith(mockMvm.feval, 'matlab.desktop.internal.webdesktop', 0, ['-hidden'])
        assert.ok(graphicsPrewarmService.hasPrewarmed, 'Should have prewarmed after settings change')
    })

    it('should not prewarm with invalid MATLAB release', async () => {
        mockConfigurationManager.getConfiguration.resolves({ prewarmGraphics: true })
        mockMvm.getMatlabRelease.returns(null)

        const graphicsPrewarmService = new GraphicsPrewarmService(mockMvm, mockConfigurationManager)
        assert.ok(!graphicsPrewarmService.hasPrewarmed, 'Should not have prewarmed yet')

        mockMvm._emitEvent(IMVM.Events.stateChange, MatlabState.READY)

        // Wait for async operations to resolve
        await new Promise(resolve => setTimeout(resolve, 0))

        sinon.assert.notCalled(mockMvm.feval)
        assert.ok(!graphicsPrewarmService.hasPrewarmed, 'Still should not have prewarmed because of invalid MATLAB release')
    })

    it('should not feval with older MATLAB release', async () => {
        mockConfigurationManager.getConfiguration.resolves({ prewarmGraphics: true })
        mockMvm.getMatlabRelease.returns('R2023a') // An older release than R2025a

        const graphicsPrewarmService = new GraphicsPrewarmService(mockMvm, mockConfigurationManager)
        assert.ok(!graphicsPrewarmService.hasPrewarmed, 'Should not have prewarmed yet')

        mockMvm._emitEvent(IMVM.Events.stateChange, MatlabState.READY)

        // Wait for async operations to resolve
        await new Promise(resolve => setTimeout(resolve, 0))

        sinon.assert.notCalled(mockMvm.feval)
        assert.ok(graphicsPrewarmService.hasPrewarmed, 'Should be marked as prewarmed with older MATLAB release')
    })

    it('should not prewarm if already prewarmed', async () => {
        mockConfigurationManager.getConfiguration.resolves({ prewarmGraphics: true })
        mockMvm.getMatlabRelease.returns('R2025a')

        const graphicsPrewarmService = new GraphicsPrewarmService(mockMvm, mockConfigurationManager)
        graphicsPrewarmService.hasPrewarmed = true // Manually set prewarmed status

        mockMvm._emitEvent(IMVM.Events.stateChange, MatlabState.READY)

        // Wait for async operations to resolve
        await new Promise(resolve => setTimeout(resolve, 0))

        sinon.assert.notCalled(mockMvm.feval)
        assert.ok(graphicsPrewarmService.hasPrewarmed, 'Should remain prewarmed and not re-prewarm')
    })

    it('should reset prewarmed status when MATLAB disconnected', async () => {
        mockConfigurationManager.getConfiguration.resolves({ prewarmGraphics: true })
        mockMvm.getMatlabRelease.returns('R2025a')

        const graphicsPrewarmService = new GraphicsPrewarmService(mockMvm, mockConfigurationManager)
        graphicsPrewarmService.hasPrewarmed = true // Manually set prewarmed status

        mockMvm._emitEvent(IMVM.Events.stateChange, MatlabState.DISCONNECTED)

        // Wait for async operations to resolve
        await new Promise(resolve => setTimeout(resolve, 0))

        assert.ok(!graphicsPrewarmService.hasPrewarmed, 'Should reset prewarmed status when MATLAB disconnects')
    })
})
