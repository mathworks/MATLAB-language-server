/// <reference types="node" />
import { IMVM, MVMError } from './MVMInterface';
import { Capability } from './RunOptions';
import EventEmitter from 'events';
export * from './MVMInterface';
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
export default class MVM extends EventEmitter implements IMVM {
    private _mvmImpl?;
    private _readyPromise?;
    private _lifecycleManager;
    constructor(lifecycleManager: any);
    eval(command: string, isUserEval?: boolean, capabilitiesToRemove?: Capability[]): Promise<void>;
    feval<T>(functionName: string, nargout: number, args: unknown[], capabilitiesToRemove?: Capability[]): Promise<MVMError | T>;
    setBreakpoint(fileName: string, lineNumber: number, condition?: string, anonymousIndex?: number): Promise<void>;
    clearBreakpoint(fileName: string, lineNumber: number, condition?: string, anonymousIndex?: number): Promise<void>;
    unpause(): void;
    interrupt(): void;
    getMatlabRelease(): string | null;
    private _handleMatlabDisconnected;
    private _handleMatlabConnected;
    private _tryAttach;
    private _handleReady;
    private _handleReadyError;
    private _detectImpl;
    private _setupDebuggerListeners;
    private _setupDebugListener;
}
