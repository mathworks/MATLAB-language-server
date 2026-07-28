// Copyright 2026 The MathWorks, Inc.

import MatlabLifecycleManager from '../../lifecycle/MatlabLifecycleManager'
import MVM from '../../mvm/impl/MVM'
import { MVMError } from '../../mvm/impl/MVMInterface'
import NotificationService, { Notification } from '../../notifications/NotificationService'
import Logger from '../../logging/Logger'

interface TestRunRequestData {
    runId: string
    testFiles: string[]
    testNames?: string[]
}

interface TestRunEvent {
    type: 'started' | 'finished' | 'complete' | 'output'
    testName: string
    text?: string
    status?: string
    duration?: number
    diagnostics?: unknown[]
}

const RUN_RESPONSE_CHANNEL = '/matlabls/testing/run/response'

export default class TestingService {
    constructor (
        private readonly matlabLifecycleManager: MatlabLifecycleManager,
        private readonly mvm: MVM
    ) {
        NotificationService.registerNotificationListener(
            Notification.TestRunRequest,
            (data: TestRunRequestData) => {
                void this.handleTestRunRequest(data)
            }
        )
    }

    private async handleTestRunRequest (data: TestRunRequestData): Promise<void> {
        const matlabConnection = await this.matlabLifecycleManager.getMatlabConnection()

        if (matlabConnection == null || !this.mvm.isReady()) {
            NotificationService.sendNotification(Notification.TestRunComplete, {
                runId: data.runId,
                error: 'MATLAB is not connected'
            })
            return
        }

        const channelId = matlabConnection.getChannelId()
        const responseChannel = `${RUN_RESPONSE_CHANNEL}/${channelId}`

        const responseSub = matlabConnection.subscribe(responseChannel, (message) => {
            const event = message as TestRunEvent

            if (event.type === 'complete') {
                matlabConnection.unsubscribe(responseSub)
                NotificationService.sendNotification(Notification.TestRunComplete, {
                    runId: data.runId
                })
            } else if (event.type === 'output') {
                NotificationService.sendNotification(Notification.TestRunOutput, {
                    runId: data.runId,
                    text: event.text ?? ''
                })
            } else {
                NotificationService.sendNotification(Notification.TestRunEvent, {
                    runId: data.runId,
                    event
                })
            }
        })

        try {
            const mdaFiles = {
                mwtype: 'string',
                mwsize: [1, data.testFiles.length],
                mwdata: data.testFiles
            }

            const mdaNames = data.testNames != null && data.testNames.length > 0
                ? { mwtype: 'string', mwsize: [1, data.testNames.length], mwdata: data.testNames }
                : { mwtype: 'string', mwsize: [1, 0], mwdata: [] }

            const response = await this.mvm.feval(
                'matlabls.handlers.testing.runTests',
                0,
                [mdaFiles, mdaNames, responseChannel]
            )

            if ('error' in response) {
                const errorMsg = (response as MVMError).error.msg
                Logger.error('Error received while running tests:')
                Logger.error(errorMsg)
                matlabConnection.unsubscribe(responseSub)
                NotificationService.sendNotification(Notification.TestRunComplete, {
                    runId: data.runId,
                    error: errorMsg
                })
            }
        } catch (err) {
            Logger.error('Error caught while running tests:')
            Logger.error(err as string)
            matlabConnection.unsubscribe(responseSub)
            NotificationService.sendNotification(Notification.TestRunComplete, {
                runId: data.runId,
                error: 'Test execution failed unexpectedly'
            })
        }
    }
}
