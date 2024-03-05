/**
 * Used to represent the state of MATLAB
 */
export declare enum MatlabState {
    DISCONNECTED = "disconnected",
    READY = "ready",
    BUSY = "busy"
}
/**
 * Provides an interface for sending evals and fevals and listening to the results.
 */
export default class MVM {
    private _mvmImpl?;
    private _readyPromise?;
    private _notificationService;
    private _lifecycleManager;
    constructor(notificationService: any, lifecycleManager: any);
    private _handleLifecycleEvent;
    private _tryAttach;
    private _handleReady;
    private _handleReadyError;
    _detectImplBasedOnTimeout(): Promise<void>;
    private _detectImpl;
    private _doEval;
    private _doFeval;
    private _doInterrupt;
    private _handleOutput;
    private _handleClc;
    private _getNewRequestId;
}
