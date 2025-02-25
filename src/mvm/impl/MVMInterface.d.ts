/// <reference types="node" />
import { Capability } from './RunOptions';
import { EventEmitter } from 'events';
/**
 * Represents text coming from MATLAB
 */
export interface TextEvent {
    text: string;
    stream: number;
}
/**
 * Represents a eval request to MATLAB
 */
export interface EvalRequest {
    requestId: string | number;
    command: string;
    isUserEval: boolean;
    capabilitiesToRemove?: Capability[];
}
/**
 * Represents a eval response to MATLAB
 */
export interface EvalResponse {
    requestId: string | number;
}
/**
 * Represents a feval request to MATLAB
 */
export interface FEvalRequest {
    requestId: string | number;
    functionName: string;
    nargout: number;
    args: unknown[];
    capabilitiesToRemove?: Capability[];
}
/**
 * Represents a feval response from MATLAB
 */
export interface FEvalResponse {
    requestId: string | number;
    result: unknown;
}
/**
* Represents a eval response to MATLAB
*/
export interface EvalResponse {
    requestId: string | number;
}
/**
 * Represents a feval request to MATLAB
 */
export interface BreakpointRequest {
    requestId: string | number;
    fileName: string;
    lineNumber: number;
    condition?: string;
    anonymousIndex?: number;
}
/**
* Represents a breakpoint response from MATLAB
*/
export interface BreakpointResponse {
    requestId: string | number;
    error?: MVMError;
}
/**
 * MATLAB Error result
 */
export interface MVMError {
    error: {
        id: string;
        msg: string;
    };
}
export declare enum PromptState {
    INITIALIZING = "INITIALIZING",
    READY = "READY",
    BUSY = "BUSY",
    DEBUG = "DEBUG",
    INPUT = "INPUT",
    PAUSE = "PAUSE",
    MORE = "MORE",
    COMPLETING_BLOCK = "COMPLETING_BLOCK"
}
export declare const STATE_REQUESTER: {
    INITIALIZING: string;
    READY: string;
    BUSY: string;
    DEBUG: string;
    INPUT: string;
    KEYBOARD: string;
    PAUSE: string;
    MORE: string;
    COMPLETING_BLOCK: string;
    BANG: string;
};
export declare const STATE_REQUESTER_TO_STATE: {
    [x: string]: PromptState;
};
/**
 * The base functionality for any MVM instance to support
 */
export interface IMVM extends EventEmitter {
    getMatlabRelease(): string | null;
    eval: (command: string, isUserEval?: boolean, capabilitiesToRemove?: Capability[]) => Promise<void>;
    feval: (functionName: string, nargout: number, args: unknown[], capabilitiesToRemove?: Capability[]) => Promise<MVMError | any>;
    setBreakpoint(fileName: string, lineNumber: number, condition?: string, anonymousIndex?: number): Promise<void>;
    clearBreakpoint(fileName: string, lineNumber: number, condition?: string, anonymousIndex?: number): Promise<void>;
    unpause(): void;
    interrupt: () => void;
}
export declare namespace IMVM {
    enum Events {
        clc = "clc",
        output = "output",
        promptChange = "promptChange",
        stateChange = "stateChange"
    }
}
