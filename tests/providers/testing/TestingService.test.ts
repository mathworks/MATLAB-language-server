// Copyright 2026 The MathWorks, Inc.
import assert from 'assert'
import sinon from 'sinon'

import getMockMvm from '../../mocks/Mvm.mock'

import ClientConnection from '../../../src/ClientConnection'
import { Notification } from '../../../src/notifications/NotificationService'
import TestingService from '../../../src/providers/testing/TestingService'

function getMockConnectionWithNotifications (): any {
    const notificationListeners: Record<string, Function> = {}
    return {
        console: {
            connection: {},
            error: sinon.stub(),
            warn: sinon.stub(),
            info: sinon.stub(),
            log: sinon.stub()
        },
        sendNotification: sinon.stub(),
        onNotification: sinon.stub().callsFake((name: string, callback: Function) => {
            notificationListeners[name] = callback
            return { dispose: sinon.stub() }
        }),
        _triggerNotification: (name: string, data: any) => {
            const listener = notificationListeners[name]
            if (listener != null) {
                listener(data)
            }
        }
    }
}

describe('TestingService', () => {
    let mockMvm: any
    let mockConnection: any
    let mockMatlabLifecycleManager: any
    let mockMatlabConnection: any
    let subscribeCallback: ((message: unknown) => void) | null

    beforeEach(() => {
        mockMvm = getMockMvm()
        mockConnection = getMockConnectionWithNotifications()
        ClientConnection._setConnection(mockConnection)

        subscribeCallback = null

        mockMatlabConnection = {
            getChannelId: sinon.stub().returns('test-channel-123'),
            subscribe: sinon.stub().callsFake((_channel: string, callback: (message: unknown) => void) => {
                subscribeCallback = callback
                return 'subscription-handle'
            }),
            unsubscribe: sinon.stub()
        }

        mockMatlabLifecycleManager = {
            getMatlabConnection: sinon.stub().resolves(mockMatlabConnection)
        }
    })

    afterEach(() => {
        sinon.restore()
        ClientConnection._clearConnection()
    })

    it('should send error notification when MATLAB connection is null', async () => {
        mockMatlabLifecycleManager.getMatlabConnection.resolves(null)

        new TestingService(mockMatlabLifecycleManager, mockMvm)

        mockConnection._triggerNotification(Notification.TestRunRequest, {
            runId: 'run-1',
            testFiles: ['/path/to/test.m'],
            testNames: []
        })

        await new Promise(resolve => setTimeout(resolve, 0))

        sinon.assert.calledWith(mockConnection.sendNotification, Notification.TestRunComplete, {
            runId: 'run-1',
            error: 'MATLAB is not connected'
        })
        sinon.assert.notCalled(mockMvm.feval)
    })

    it('should send error notification when MVM is not ready', async () => {
        mockMvm.isReady.returns(false)

        new TestingService(mockMatlabLifecycleManager, mockMvm)

        mockConnection._triggerNotification(Notification.TestRunRequest, {
            runId: 'run-2',
            testFiles: ['/path/to/test.m']
        })

        await new Promise(resolve => setTimeout(resolve, 0))

        sinon.assert.calledWith(mockConnection.sendNotification, Notification.TestRunComplete, {
            runId: 'run-2',
            error: 'MATLAB is not connected'
        })
        sinon.assert.notCalled(mockMatlabConnection.subscribe)
        sinon.assert.notCalled(mockMvm.feval)
    })

    it('should subscribe to response channel and call feval when connected', async () => {
        mockMvm.isReady.returns(true)
        mockMvm.feval.resolves({})

        new TestingService(mockMatlabLifecycleManager, mockMvm)

        mockConnection._triggerNotification(Notification.TestRunRequest, {
            runId: 'run-3',
            testFiles: ['/path/to/TestA.m', '/path/to/TestB.m']
        })

        await new Promise(resolve => setTimeout(resolve, 0))

        sinon.assert.calledOnce(mockMatlabConnection.subscribe)
        sinon.assert.calledWith(
            mockMatlabConnection.subscribe,
            '/matlabls/testing/run/response/test-channel-123',
            sinon.match.func
        )

        sinon.assert.calledOnce(mockMvm.feval)
        sinon.assert.calledWith(
            mockMvm.feval,
            'matlabls.handlers.testing.runTests',
            0,
            [
                { mwtype: 'string', mwsize: [1, 2], mwdata: ['/path/to/TestA.m', '/path/to/TestB.m'] },
                { mwtype: 'string', mwsize: [1, 0], mwdata: [] },
                '/matlabls/testing/run/response/test-channel-123'
            ]
        )
    })

    it('should encode test names as MDA when provided', async () => {
        mockMvm.isReady.returns(true)
        mockMvm.feval.resolves({})

        new TestingService(mockMatlabLifecycleManager, mockMvm)

        mockConnection._triggerNotification(Notification.TestRunRequest, {
            runId: 'run-4',
            testFiles: ['/path/to/TestA.m'],
            testNames: ['TestA/testMethod1', 'TestA/testMethod2']
        })

        await new Promise(resolve => setTimeout(resolve, 0))

        const fevalArgs = mockMvm.feval.firstCall.args[2]
        assert.deepStrictEqual(fevalArgs[1], {
            mwtype: 'string',
            mwsize: [1, 2],
            mwdata: ['TestA/testMethod1', 'TestA/testMethod2']
        })
    })

    it('should forward test events as notifications', async () => {
        mockMvm.isReady.returns(true)
        mockMvm.feval.resolves({})

        new TestingService(mockMatlabLifecycleManager, mockMvm)

        mockConnection._triggerNotification(Notification.TestRunRequest, {
            runId: 'run-5',
            testFiles: ['/path/to/TestA.m']
        })

        await new Promise(resolve => setTimeout(resolve, 0))

        assert.ok(subscribeCallback != null, 'Subscribe callback should be set')
        subscribeCallback!({ type: 'started', testName: 'TestA/testMethod1' })

        sinon.assert.calledWith(mockConnection.sendNotification, Notification.TestRunEvent, {
            runId: 'run-5',
            event: { type: 'started', testName: 'TestA/testMethod1' }
        })

        subscribeCallback!({ type: 'finished', testName: 'TestA/testMethod1', status: 'passed', duration: 0.5 })

        sinon.assert.calledWith(mockConnection.sendNotification, Notification.TestRunEvent, {
            runId: 'run-5',
            event: { type: 'finished', testName: 'TestA/testMethod1', status: 'passed', duration: 0.5 }
        })
    })

    it('should unsubscribe and send complete notification on complete event', async () => {
        mockMvm.isReady.returns(true)
        mockMvm.feval.resolves({})

        new TestingService(mockMatlabLifecycleManager, mockMvm)

        mockConnection._triggerNotification(Notification.TestRunRequest, {
            runId: 'run-6',
            testFiles: ['/path/to/TestA.m']
        })

        await new Promise(resolve => setTimeout(resolve, 0))

        assert.ok(subscribeCallback != null, 'Subscribe callback should be set')
        subscribeCallback!({ type: 'complete', testName: '' })

        sinon.assert.calledOnce(mockMatlabConnection.unsubscribe)
        sinon.assert.calledWith(mockMatlabConnection.unsubscribe, 'subscription-handle')

        sinon.assert.calledWith(mockConnection.sendNotification, Notification.TestRunComplete, {
            runId: 'run-6'
        })
    })

    it('should unsubscribe and send error on feval error response', async () => {
        mockMvm.isReady.returns(true)
        mockMvm.feval.resolves({ error: { msg: 'Function not found' } })

        new TestingService(mockMatlabLifecycleManager, mockMvm)

        mockConnection._triggerNotification(Notification.TestRunRequest, {
            runId: 'run-7',
            testFiles: ['/path/to/TestA.m']
        })

        await new Promise(resolve => setTimeout(resolve, 0))

        sinon.assert.calledOnce(mockMatlabConnection.unsubscribe)
        sinon.assert.calledWith(mockConnection.sendNotification, Notification.TestRunComplete, {
            runId: 'run-7',
            error: 'Function not found'
        })
    })

    it('should unsubscribe and send error on feval exception', async () => {
        mockMvm.isReady.returns(true)
        mockMvm.feval.rejects(new Error('Connection lost'))

        new TestingService(mockMatlabLifecycleManager, mockMvm)

        mockConnection._triggerNotification(Notification.TestRunRequest, {
            runId: 'run-8',
            testFiles: ['/path/to/TestA.m']
        })

        await new Promise(resolve => setTimeout(resolve, 0))

        sinon.assert.calledOnce(mockMatlabConnection.unsubscribe)
        sinon.assert.calledWith(mockConnection.sendNotification, Notification.TestRunComplete, {
            runId: 'run-8',
            error: 'Test execution failed unexpectedly'
        })
    })
})
