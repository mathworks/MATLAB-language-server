// Copyright 2026 The MathWorks, Inc.

import MatlabLifecycleManager from '../lifecycle/MatlabLifecycleManager'
import NotificationService, { Notification } from '../notifications/NotificationService'

interface OpenedEvent {
    Event: 'opened'
    Name: string
    RootFolder: string
    Description: string
}

interface ClosedEvent {
    Event: 'closed'
}

type ProjectEvent = OpenedEvent | ClosedEvent

/**
 * Handles project events from MATLAB and notifies the client when a project is opened or closed.
 */
export default class ProjectEventNotifier {
    private eventSubscription: any

    constructor (private readonly matlabLifecycleManager: MatlabLifecycleManager) {
        matlabLifecycleManager.eventEmitter.on('connected', this.setupListeners.bind(this))
        matlabLifecycleManager.eventEmitter.on('disconnected', this.removeListeners.bind(this))
    }

    private async setupListeners () {
        const matlabConnection = await this.matlabLifecycleManager.getMatlabConnection()

        if (matlabConnection == null) {
            return
        }

        const notificationChannel = '/matlabls/project/event'
        this.eventSubscription = matlabConnection.subscribe(notificationChannel, message => {
            const event = message as ProjectEvent

            if (event.Event === 'opened') {
                // Opened event
                NotificationService.sendNotification(Notification.ProjectOpened, {
                    name: event.Name,
                    rootFolder: event.RootFolder,
                    description: event.Description
                })
            } else {
                // Closed event
                NotificationService.sendNotification(Notification.ProjectClosed)
            }
        })
    }

    private removeListeners () {
        this.eventSubscription?.unsubscribe()
    }
}
