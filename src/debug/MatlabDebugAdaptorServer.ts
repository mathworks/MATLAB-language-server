// Copyright 2024 The MathWorks, Inc.

import MatlabDebugAdaptor from './MatlabDebugAdaptor';
import { IMVM } from '../mvm/impl/MVM';
import NotificationService, { Notification } from '../notifications/NotificationService';
import { DebugServices } from './DebugServices'
import { DebugProtocol } from '@vscode/debugprotocol';

interface PackagedRequest {
    debugRequest: DebugProtocol.Request
    tag: unknown
}

interface PackagedResponse {
    debugResponse: DebugProtocol.Response
    tag: unknown
}

interface PackagedEvent {
    debugEvent: DebugProtocol.Event
}

interface TaggedData {
    tag: unknown
}

export default class MatlabDebugAdaptorServer extends MatlabDebugAdaptor {
    private _notifier: typeof NotificationService;

    constructor (mvm: IMVM, debugServices: DebugServices) {
        super(mvm, debugServices);

        this._notifier = NotificationService;

        this._notifier.registerNotificationListener(Notification.DebugAdaptorRequest, this._handleServerRequest.bind(this));
    }

    protected _handleDebuggingStateChange (): void {
        this._notifier.sendNotification(Notification.DebuggingStateChange, this._isCurrentlyDebugging);
    }

    private _handleServerRequest (packagedRequest: PackagedRequest): void {
        const request = packagedRequest.debugRequest;

        const response = {
            seq: 0,
            type: 'response',
            success: true,
            command: request.command,
            request_seq: request.seq,
            tag: packagedRequest.tag
        };

        this.handleRequest(request, response);
    }

    sendResponse (response: DebugProtocol.Response): void {
        const tag = (response as unknown as TaggedData).tag;
        delete (response as unknown as TaggedData).tag
        const packagedResponse = {
            debugResponse: response,
            tag
        } as PackagedResponse;
        NotificationService.sendNotification(Notification.DebugAdaptorResponse, packagedResponse);
    }

    sendEvent (event: DebugProtocol.Event): void {
        const packagedEvent = {
            debugEvent: event
        } as PackagedEvent;
        NotificationService.sendNotification(Notification.DebugAdaptorEvent, packagedEvent);
    }
}
