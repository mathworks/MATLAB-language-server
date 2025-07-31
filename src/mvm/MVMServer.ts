// Copyright 2024-2025 The MathWorks, Inc.

import NotificationService, { Notification } from '../notifications/NotificationService'
import MVM, { IMVM, MatlabState, EvalRequest, EvalResponse, FEvalRequest, FEvalResponse, BreakpointRequest, PromptState } from './impl/MVM'

/**
 * Provides an interface for sending evals and fevals and listening to the results.
 */
export default class MVMServer {
    private readonly _mvm: MVM;
    private readonly _notificationService: typeof NotificationService;

    constructor (mvm: MVM, notificationService: typeof NotificationService) {
        this._mvm = mvm;
        this._notificationService = notificationService;

        this._setupListeners();

        // Set up connection notification listeners
        this._notificationService.registerNotificationListener(Notification.MVMEvalRequest, this._doEval.bind(this));
        this._notificationService.registerNotificationListener(Notification.MVMFevalRequest, this._doFeval.bind(this));
        this._notificationService.registerNotificationListener(Notification.MVMInterruptRequest, this._doInterrupt.bind(this));
        this._notificationService.registerNotificationListener(Notification.MVMSetBreakpointRequest, this._doSetBreakpoint.bind(this));
        this._notificationService.registerNotificationListener(Notification.MVMClearBreakpointRequest, this._doClearBreakpoint.bind(this));
        this._notificationService.registerNotificationListener(Notification.MVMUnpauseRequest, this._doUnpause.bind(this));
    }

    private _setupListeners (): void {
        this._mvm.on(IMVM.Events.stateChange, this._handleMvmStateChange.bind(this))
        this._mvm.on(IMVM.Events.output, this._handleOutput.bind(this));
        this._mvm.on(IMVM.Events.clc, this._handleClc.bind(this));
        this._mvm.on(IMVM.Events.promptChange, this._handlePromptChange.bind(this));
    }

    private _handleMvmStateChange (state: MatlabState, release?: string): void {
        this._notificationService.sendNotification(Notification.MVMStateChange, { state, release });
    }

    private _doEval (data: EvalRequest): void {
        const requestId = data.requestId;

        if (requestId === undefined) {
            return;
        }

        void this._mvm.eval(data.command, data.isUserEval, data.capabilitiesToRemove)?.then(() => {
            this._notificationService.sendNotification(Notification.MVMEvalComplete, {
                requestId
            } as EvalResponse)
        });
    }

    private _doFeval (data: FEvalRequest): void {
        const requestId = data.requestId;
        if (requestId === undefined) {
            return;
        }
        void this._mvm.feval(data.functionName, data.nargout, data.args, data.isUserEval, data.capabilitiesToRemove)?.then((result: unknown) => {
            this._notificationService.sendNotification(Notification.MVMFevalComplete, {
                requestId,
                result
            } as FEvalResponse);
        });
    }

    private _doSetBreakpoint (data: BreakpointRequest): void {
        const requestId = data.requestId;
        if (requestId === undefined) {
            return;
        }
        void this._mvm.setBreakpoint(data.fileName, data.lineNumber, data.condition, data.anonymousIndex)?.then((result: unknown) => {
            this._notificationService.sendNotification(Notification.MVMSetBreakpointComplete, {
                requestId,
                result
            });
        });
    }

    private _doClearBreakpoint (data: BreakpointRequest): void {
        const requestId = data.requestId;
        if (requestId === undefined) {
            return;
        }
        void this._mvm.clearBreakpoint(data.fileName, data.lineNumber, data.condition, data.anonymousIndex)?.then((result: unknown) => {
            this._notificationService.sendNotification(Notification.MVMClearBreakpointComplete, {
                requestId,
                result
            });
        });
    }

    private _doInterrupt (): void {
        this._mvm.interrupt();
    }

    private _doUnpause (): void {
        this._mvm.unpause();
    }

    private _handleOutput (data: unknown): void {
        this._notificationService.sendNotification(Notification.MVMText, data)
    }

    private _handleClc (): void {
        this._notificationService.sendNotification(Notification.MVMClc);
    }

    private _handlePromptChange (state: PromptState, isIdle: boolean): void {
        this._notificationService.sendNotification(Notification.MVMPromptChange, {
            state,
            isIdle
        });
    }
}
