// Copyright 2024 The MathWorks, Inc.

import * as debug from '@vscode/debugadapter'
import { DebugProtocol } from '@vscode/debugprotocol';
import { DebugServices, BreakpointInfo } from './DebugServices'
import { ResolvablePromise, createResolvablePromise } from '../utils/PromiseUtils'
import { IMVM, MVMError, MatlabState } from '../mvm/impl/MVM';

enum BreakpointChangeType {
    ADD,
    REMOVE
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MatlabData = any;

const mdaLength = function (obj: MatlabData): number {
    if (obj instanceof Array) {
        return obj.length;
    } else if (obj.mwsize !== undefined) {
        return obj.mwsize[0];
    } else {
        return 1;
    }
}

const mdaUnwrap = function (obj: MatlabData, property?: string, index?: number): MatlabData {
    const handleIndex = (intermediate: MatlabData, index?: number): MatlabData => {
        if (intermediate instanceof Array) {
            return intermediate[index ?? 0];
        } else if (index !== undefined) {
            if (index === 0 && intermediate[index] === undefined) {
                return intermediate;
            } else {
                return intermediate[index];
            }
        } else {
            return intermediate;
        }
    };

    if (obj.mwdata !== undefined) {
        if (property !== undefined) {
            return handleIndex(obj.mwdata[property], index);
        } else {
            return handleIndex(obj.mwdata, index);
        }
    } else {
        if (property !== undefined) {
            return handleIndex(obj[property], index);
        } else {
            return handleIndex(obj, index);
        }
    }
}

const isError = function <T> (value: T | MVMError): boolean {
    return typeof (value) === 'object' && (value != null) && 'error' in value;
}

export default class MatlabDebugAdaptor {
    static _nextId = 1;
    private _debugServices: DebugServices;
    private _mvm: IMVM;

    private _numberOfStackFrames: number = -1;

    private _pendingSetBreakpointPromise?: ResolvablePromise<void>;
    private _pendingVariablesPromise?: ResolvablePromise<void>;

    private _breakpointChangeListeners: Array<(type: BreakpointChangeType, bp: BreakpointInfo) => void> = [];

    private _matlabBreakpoints: BreakpointInfo[] = [];

    private _canonicalizedPathCache: Map<string, ResolvablePromise<string>> = new Map();

    private _isCurrentlyStopped: boolean = false;
    protected _isCurrentlyDebugging: boolean = false;

    private _hasShownReplWarning: number = 0;

    constructor (mvm: IMVM, debugServices: DebugServices) {
        this._mvm = mvm;
        this._debugServices = debugServices;

        this._pendingSetBreakpointPromise = undefined;
        this._pendingVariablesPromise = undefined;

        this._mvm.on(IMVM.Events.stateChange, (state: MatlabState) => {
            if (state === MatlabState.DISCONNECTED) {
                this._handleDisconnect();
                this._matlabBreakpoints = [];
            }
        });

        this._setupListeners();
    }

    handleRequest (request: DebugProtocol.Request, response: debug.Response): void {
        try {
            if (request.command === 'initialize') {
                void this.initializeRequest(response as DebugProtocol.InitializeResponse, request.arguments);
            } else if (request.command === 'terminate') {
                void this.terminateRequest(response as DebugProtocol.TerminateResponse, request.arguments, request);
            } else if (request.command === 'setBreakpoints') {
                void this.setBreakPointsRequest(response as DebugProtocol.SetBreakpointsResponse, request.arguments, request);
            } else if (request.command === 'continue') {
                void this.continueRequest(response as DebugProtocol.ContinueResponse, request.arguments, request);
            } else if (request.command === 'next') {
                void this.nextRequest(response as DebugProtocol.NextResponse, request.arguments, request);
            } else if (request.command === 'stepIn') {
                void this.stepInRequest(response as DebugProtocol.StepInResponse, request.arguments, request);
            } else if (request.command === 'stepOut') {
                void this.stepOutRequest(response as DebugProtocol.StepOutResponse, request.arguments, request);
            } else if (request.command === 'pause') {
                void this.pauseRequest(response as DebugProtocol.PauseResponse, request.arguments, request);
            } else if (request.command === 'stackTrace') {
                void this.stackTraceRequest(response as DebugProtocol.StackTraceResponse, request.arguments, request);
            } else if (request.command === 'scopes') {
                void this.scopesRequest(response as DebugProtocol.ScopesResponse, request.arguments, request);
            } else if (request.command === 'variables') {
                void this.variablesRequest(response as DebugProtocol.VariablesResponse, request.arguments, request);
            } else if (request.command === 'source') {
                void this.sourceRequest(response as DebugProtocol.SourceResponse, request.arguments, request);
            } else if (request.command === 'threads') {
                void this.threadsRequest(response as DebugProtocol.ThreadsResponse, request);
            } else if (request.command === 'evaluate') {
                void this.evaluateRequest(response as DebugProtocol.EvaluateResponse, request.arguments, request);
            } else if (request.command === 'launch') {
                this.sendResponse(response);
            } else if (request.command === 'attach') {
                this.sendResponse(response);
            } else if (request.command === 'disconnect') {
                this.sendResponse(response);
            } else if (request.command === 'restart') {
                this.sendResponse(response);
            } else if (request.command === 'setFunctionBreakpoints') {
                this.sendResponse(response);
            } else if (request.command === 'setExceptionBreakpoints') {
                this.sendResponse(response);
            } else if (request.command === 'configurationDone') {
                this.sendResponse(response);
            } else if (request.command === 'stepBack') {
                this.sendResponse(response);
            } else if (request.command === 'reverseContinue') {
                this.sendResponse(response);
            } else if (request.command === 'restartFrame') {
                this.sendResponse(response);
            } else if (request.command === 'goto') {
                this.sendResponse(response);
            } else if (request.command === 'setVariable') {
                this.sendResponse(response);
            } else if (request.command === 'setExpression') {
                this.sendResponse(response);
            } else if (request.command === 'terminateThreads') {
                this.sendResponse(response);
            } else if (request.command === 'stepInTargets') {
                this.sendResponse(response);
            } else if (request.command === 'gotoTargets') {
                this.sendResponse(response);
            } else if (request.command === 'completions') {
                this.sendResponse(response);
            } else if (request.command === 'exceptionInfo') {
                this.sendResponse(response);
            } else if (request.command === 'loadedSources') {
                this.sendResponse(response);
            } else if (request.command === 'dataBreakpointInfo') {
                this.sendResponse(response);
            } else if (request.command === 'setDataBreakpoints') {
                this.sendResponse(response);
            } else if (request.command === 'readMemory') {
                this.sendResponse(response);
            } else if (request.command === 'writeMemory') {
                this.sendResponse(response);
            } else if (request.command === 'disassemble') {
                this.sendResponse(response);
            } else if (request.command === 'cancel') {
                this.sendResponse(response);
            } else if (request.command === 'breakpointLocations') {
                this.sendResponse(response);
            } else if (request.command === 'setInstructionBreakpoints') {
                this.sendResponse(response);
            } else {
                this.customRequest(request.command, response as DebugProtocol.Response, request.arguments, request);
            }
        } catch (e) {
            console.log('Error with debug request', e);
        }
    }

    sendResponse (response: DebugProtocol.Response): void {
        throw new Error('Unimplemented method: sendResponse');
    }

    sendEvent (event: DebugProtocol.Event): void {
        throw new Error('Unimplemented method: sendResponse');
    }

    private async _waitForPendingBreakpointsRequest (): Promise<void> {
        while (this._pendingSetBreakpointPromise !== undefined) {
            await this._pendingSetBreakpointPromise;
        }
        this._pendingSetBreakpointPromise = createResolvablePromise();
    }

    private async _waitForPendingVariablesRequest (): Promise<void> {
        while (this._pendingVariablesPromise !== undefined) {
            await this._pendingVariablesPromise;
        }
        this._pendingVariablesPromise = createResolvablePromise();
    }

    private _clearPendingBreakpointsRequest (): void {
        const oldPromise = this._pendingSetBreakpointPromise;
        this._pendingSetBreakpointPromise = undefined;
        oldPromise?.resolve();
    }

    private _clearPendingVariablesRequest (): void {
        const oldPromise = this._pendingVariablesPromise;
        this._pendingVariablesPromise = undefined;
        oldPromise?.resolve();
    }

    private _setupListeners (): void {
        this._debugServices.on(DebugServices.Events.BreakpointAdded, async (breakpoint: BreakpointInfo) => {
            this._matlabBreakpoints.push(breakpoint);

            this._breakpointChangeListeners.forEach((listener) => {
                listener(BreakpointChangeType.ADD, breakpoint);
            });
        });

        this._debugServices.on(DebugServices.Events.BreakpointRemoved, async (breakpoint: BreakpointInfo) => {
            this._matlabBreakpoints = this._matlabBreakpoints.filter((existingBreakpoint) => {
                return !existingBreakpoint.equals(breakpoint, true);
            });

            this._breakpointChangeListeners.forEach((listener) => {
                listener(BreakpointChangeType.REMOVE, breakpoint);
            });
        });

        this._debugServices.on(DebugServices.Events.DBEnter, async () => {
            const oldValue = this._isCurrentlyDebugging;
            this._isCurrentlyDebugging = true;
            if (oldValue !== this._isCurrentlyDebugging) {
                this._handleDebuggingStateChange();
            }
        });

        this._debugServices.on(DebugServices.Events.DBExit, async (isDebuggerStillActive: boolean) => {
            const oldValue = this._isCurrentlyDebugging;
            this._isCurrentlyDebugging = isDebuggerStillActive;
            if (oldValue !== this._isCurrentlyDebugging) {
                this._handleDebuggingStateChange();
            }

            if (isDebuggerStillActive) {
                this.sendEvent(new debug.StoppedEvent('breakpoint', 0));
                return;
            }

            this.sendEvent(new debug.ExitedEvent(0));
            this.sendEvent(new debug.TerminatedEvent(false));
        });

        this._debugServices.on(DebugServices.Events.DBCont, async () => {
            this._isCurrentlyStopped = false;

            this.sendEvent(new debug.ContinuedEvent(0, true));
        });

        this._debugServices.on(DebugServices.Events.DBStop, async (filename: string, lineNumber: number, stack: MatlabData[]) => {
            this._isCurrentlyStopped = true;

            const oldValue = this._isCurrentlyDebugging;
            this._isCurrentlyDebugging = true;
            if (oldValue !== this._isCurrentlyDebugging) {
                this._handleDebuggingStateChange();
            }

            this.sendEvent(new debug.StoppedEvent('breakpoint', 0));
        });
    }

    protected _handleDebuggingStateChange (): void {
        // Intentionally unimplemented
    }

    private _registerBreakpointChangeListener (listener: (type: BreakpointChangeType, bp: BreakpointInfo) => void): { remove: () => void } {
        this._breakpointChangeListeners.push(listener);
        return {
            remove: () => {
                const index = this._breakpointChangeListeners.indexOf(listener);
                if (index !== -1) {
                    this._breakpointChangeListeners.splice(index, 1);
                }
            }
        };
    }

    initializeRequest (response: DebugProtocol.InitializeResponse, args: DebugProtocol.InitializeRequestArguments): void {
        response.body = {
            // Supported Features
            supportsConfigurationDoneRequest: true,
            supportsConditionalBreakpoints: true,
            supportsEvaluateForHovers: true,
            supportsExceptionOptions: true,
            supportsExceptionInfoRequest: true,
            supportTerminateDebuggee: true,
            supportsTerminateRequest: true,
            supportsCancelRequest: true,
            supportsSingleThreadExecutionRequests: true,
            supportsSteppingGranularity: true,
            // Unsupported Features
            supportsHitConditionalBreakpoints: false,
            supportsFunctionBreakpoints: false,
            supportsStepBack: false,
            supportsSetVariable: false,
            supportsRestartFrame: false,
            supportsGotoTargetsRequest: false,
            supportsStepInTargetsRequest: false,
            supportsCompletionsRequest: false,
            supportsModulesRequest: false,
            supportsRestartRequest: true,
            supportsValueFormattingOptions: false,
            supportSuspendDebuggee: false,
            supportsDelayedStackTraceLoading: false,
            supportsLoadedSourcesRequest: false,
            supportsLogPoints: false,
            supportsTerminateThreadsRequest: false,
            supportsSetExpression: false,
            supportsDataBreakpoints: false,
            supportsReadMemoryRequest: false,
            supportsWriteMemoryRequest: false,
            supportsDisassembleRequest: false,
            supportsBreakpointLocationsRequest: false,
            supportsClipboardContext: false,
            supportsInstructionBreakpoints: false,
            supportsExceptionFilterOptions: false
        } as DebugProtocol.Capabilities;

        this.sendResponse(response);
        this.sendEvent(new debug.InitializedEvent());

        if (this._isCurrentlyStopped) {
            this.sendEvent(new debug.StoppedEvent('breakpoint', 0));
        }
    }

    async disconnectRequest (response: DebugProtocol.DisconnectResponse, args: DebugProtocol.DisconnectArguments, request?: DebugProtocol.Request): Promise<void> {
        void this._handleClientDisconnectRequest(response);
    }

    async terminateRequest (response: DebugProtocol.TerminateResponse, args: DebugProtocol.TerminateArguments, request?: DebugProtocol.Request): Promise<void> {
        void this._handleClientDisconnectRequest(response);
    }

    private async _handleClientDisconnectRequest (response: DebugProtocol.Response): Promise<void> {
        if (!this._isCurrentlyStopped) {
            this._mvm.interrupt();
        }

        try {
            await this._mvm.eval("if system_dependent('IsDebugMode')==1, dbquit all; end");
        } catch (e) {}

        this.sendResponse(response);

        this._cleanup();

        this.sendEvent(new debug.ExitedEvent(0));
        this.sendEvent(new debug.TerminatedEvent(false));
    }

    async setBreakPointsRequest (response: DebugProtocol.SetBreakpointsResponse, args: DebugProtocol.SetBreakpointsArguments, request?: DebugProtocol.Request): Promise<void> {
        const source = args.source as debug.Source;

        if (source.path === undefined) {
            this.sendResponse(response);
            return;
        }

        try {
            await this._waitForPendingBreakpointsRequest();
        } catch (e) {
            return;
        }

        const canonicalizedPath = await this._getCanonicalPath(source.path);

        const newBreakpoints: BreakpointInfo[] = (args.breakpoints != null)
            ? args.breakpoints.map((breakpoint) => {
                return new BreakpointInfo(canonicalizedPath, breakpoint.line, breakpoint.condition, 0);
            })
            : [];

        const matlabBreakpointsForFile = this._matlabBreakpoints.filter((breakpoint) => {
            return breakpoint.filePath === canonicalizedPath;
        });

        const breakpointsToAdd = newBreakpoints.map((newBreakpoint) => {
            if (matlabBreakpointsForFile.some((matlabBreakpoint) => {
                return newBreakpoint.equals(matlabBreakpoint, false);
            })) {
                return {
                    preexisting: true,
                    info: newBreakpoint
                };
            } else {
                return {
                    preexisting: false,
                    info: newBreakpoint
                };
            }
        });

        const breakpointsToRemove = matlabBreakpointsForFile.filter((matlabBreakpoint) => {
            return !newBreakpoints.some((newBreakpoint) => {
                return newBreakpoint.equals(matlabBreakpoint, true);
            });
        });

        // Remove all breakpoints that are now gone.
        const breakpointsRemovalPromises: Array<Promise<void>> = [];
        breakpointsToRemove.forEach((breakpoint: BreakpointInfo) => {
            breakpointsRemovalPromises.push(this._mvm.clearBreakpoint(breakpoint.filePath, breakpoint.lineNumber));
        })
        await Promise.all(breakpointsRemovalPromises);

        response.body = {
            breakpoints: []
        }

        for (const newBreakpoint of breakpointsToAdd) {
            // Pre-existing breakpoints are not sent to the server.
            if (newBreakpoint.preexisting) {
                const breakpoint = new debug.Breakpoint(true, newBreakpoint.info.lineNumber, undefined, source);
                response.body.breakpoints.push(breakpoint);
                continue;
            }

            let matlabBreakpointInfos: BreakpointInfo[] = [];
            const listener = this._registerBreakpointChangeListener((changeType, bpInfo) => {
                if (changeType === BreakpointChangeType.ADD && bpInfo.filePath === canonicalizedPath) {
                    matlabBreakpointInfos.push(bpInfo);
                }
            });

            await this._mvm.setBreakpoint(canonicalizedPath, newBreakpoint.info.lineNumber, newBreakpoint.info.condition);

            listener.remove();

            if (matlabBreakpointInfos.length === 0) {
                matlabBreakpointInfos.push(new BreakpointInfo(canonicalizedPath, newBreakpoint.info.lineNumber, undefined, 0))
            } else if (matlabBreakpointInfos.length > 1) {
                matlabBreakpointInfos = [matlabBreakpointInfos[0]];
            }

            const matlabBP = matlabBreakpointInfos[0];
            const breakpoint = new debug.Breakpoint(true, matlabBP.lineNumber, undefined, source);

            response.body.breakpoints.push(breakpoint);
        }

        this.sendResponse(response)
        this._clearPendingBreakpointsRequest();
    }

    async continueRequest (response: DebugProtocol.ContinueResponse, args: DebugProtocol.ContinueArguments, request?: DebugProtocol.Request): Promise<void> {
        try {
            await this._mvm.eval("if system_dependent('IsDebugMode')==1, dbcont; end");
        } catch (e) {}
        this.sendResponse(response);
    }

    async nextRequest (response: DebugProtocol.NextResponse, args: DebugProtocol.NextArguments, request?: DebugProtocol.Request): Promise<void> {
        try {
            await this._mvm.eval("if system_dependent('IsDebugMode')==1, dbstep; end");
        } catch (e) {}

        this.sendResponse(response);
    }

    async stepInRequest (response: DebugProtocol.StepInResponse, args: DebugProtocol.StepInArguments, request?: DebugProtocol.Request): Promise<void> {
        try {
            await this._mvm.eval("if system_dependent('IsDebugMode')==1, dbstep in; end");
        } catch (e) {}
        this.sendResponse(response);
    }

    async stepOutRequest (response: DebugProtocol.StepOutResponse, args: DebugProtocol.StepOutArguments, request?: DebugProtocol.Request): Promise<void> {
        try {
            await this._mvm.eval("if system_dependent('IsDebugMode')==1, dbstep out; end");
        } catch (e) {}
        this.sendResponse(response);
    }

    sourceRequest (response: DebugProtocol.SourceResponse, args: DebugProtocol.SourceArguments, request?: DebugProtocol.Request): void {
        this.sendResponse(response)
    }

    threadsRequest (response: DebugProtocol.ThreadsResponse, request?: DebugProtocol.Request): void {
        response.body = {
            threads: [
                new debug.Thread(0, 'MATLAB')
            ]
        };
        this.sendResponse(response);
    }

    async stackTraceRequest (response: DebugProtocol.StackTraceResponse, args: DebugProtocol.StackTraceArguments, request?: DebugProtocol.Request): Promise<void> {
        response.body = { stackFrames: [], totalFrames: 0 };
        this._numberOfStackFrames = 0;

        let stackResponse: MatlabData;
        try {
            stackResponse = await this._mvm.feval('dbstack', 1, ['-completenames']);
        } catch (e) {
            return;
        }

        const transformStack = (stack: MatlabData): debug.StackFrame[] => {
            if (stack[0]?.mwtype !== undefined) {
                stack = stack[0]
                const size = stack.mwsize[0];
                const newStack = [];
                for (let i = 0; i < size; i++) {
                    
                    newStack.push(new debug.StackFrame(size - i + 1, stack.mwdata.name[i], new debug.Source(stack.mwdata.name[i], stack.mwdata.file[i]), Math.abs(stack.mwdata.line[i]), 1))
                }
                return newStack;
            } else {
                const numberOfStackFrames: number = stack.length;
                return stack.map((stackFrame: MatlabData, i: number) => new debug.StackFrame(numberOfStackFrames - i + 1, stackFrame.name, new debug.Source(stackFrame.name as string, stackFrame.file as string), Math.abs(stackFrame.line), 1));
            }
        };

        const stack = transformStack(stackResponse.result);
        const baseFrame = new debug.StackFrame(1, 'Base');
        baseFrame.presentationHint = 'label';
        stack.push(baseFrame);

        response.body = { stackFrames: stack, totalFrames: stack.length };

        this._numberOfStackFrames = stack.length;

        this.sendResponse(response)
    }

    scopesRequest (response: DebugProtocol.ScopesResponse, args: DebugProtocol.ScopesArguments, request?: DebugProtocol.Request): void {
        const scope: DebugProtocol.Scope = {
            name: 'Locals',
            variablesReference: args.frameId,
            expensive: false,
            presentationHint: 'locals'
        }
        response.body = {
            scopes: [
                scope
            ]
        }

        this.sendResponse(response)
    }

    async variablesRequest (response: DebugProtocol.VariablesResponse, args: DebugProtocol.VariablesArguments, request?: DebugProtocol.Request): Promise<void> {
        response.body = { variables: [] };

        let stackChanger;
        try {
            stackChanger = await this._moveToFrame(args.variablesReference);
        } catch (e) {
            this.sendResponse(response);
            return;
        }

        const maybeVariableResult = await this._mvm.feval<MatlabData>('matlab.internal.datatoolsservices.getWorkspaceDisplay', 1, ['caller']);

        if (stackChanger != null) {
            try {
                void stackChanger.revert();
            } catch (e) {
                this.sendResponse(response);
                return;
            }
        }

        if (isError(maybeVariableResult)) {
            this.sendResponse(response);
            return;
        }

        const variableResult: MatlabData = maybeVariableResult.result[0];
        const numberOfVariables = mdaLength(variableResult);

        const unwrap = (struct: MatlabData, field: string, index: number): MatlabData => mdaUnwrap(mdaUnwrap(struct, field, index));

        for (let i = 0; i < numberOfVariables; i++) {
            const name = unwrap(variableResult, 'Name', i);
            const type = unwrap(variableResult, 'Class', i) as string;
            const size = unwrap(variableResult, 'Size', i) as number;
            const value = unwrap(variableResult, 'Value', i);
            // eslint-disable-next-line  @typescript-eslint/no-unused-vars
            const isSummary = unwrap(variableResult, 'IsSummary', i);

            const combinedType = type === 'double' ? `${size}` : `${size} ${type}`;

            const variable: DebugProtocol.Variable = {
                name,
                value,
                type: combinedType,
                presentationHint: {
                    kind: 'data',
                    attributes: [],
                    visibility: 'public',
                    lazy: false
                },
                evaluateName: undefined,
                variablesReference: 0
            };

            variable?.presentationHint?.attributes?.push('readOnly');

            response.body.variables.push(variable);
        }

        this.sendResponse(response);
    }

    async evaluateRequest (response: DebugProtocol.EvaluateResponse, args: DebugProtocol.EvaluateArguments, request?: DebugProtocol.Request): Promise<void> {

        let stackChanger;
        try {
            stackChanger = await this._moveToFrame(args.frameId);
        } catch (e) {
            this.sendResponse(response);
            return;
        }

        let maybeResult;
        const oldHotlinks = await this._mvm.feval('feature', 1, ['HotLinks']);
        if (args.context === 'repl') {
            maybeResult = await this._mvm.feval<string>('evalc', 1, ['try, feature(\'HotLinks\', 0); ' + args.expression + ', catch exceptionObj; try; showReport(exceptionObj), end; clear exceptionObj; end']);
            if (this._hasShownReplWarning < 3) {
                this.sendEvent(new debug.OutputEvent('For best results, evaluate expressions in the MATLAB Terminal.', 'console'));
                this._hasShownReplWarning++;
            }
        } else if (args.context === 'watch') {
            maybeResult = await this._mvm.feval<MatlabData>('evalc', 1, ['try, disp(' + args.expression + "), catch, disp('Error evaluating expression'); end"]);
        } else {
            maybeResult = await this._mvm.feval<MatlabData>('evalc', 1, ["try, datatipinfo('" + args.expression + "'), catch, disp('Error evaluating expression'); end"]);
        }

        await this._mvm.feval('feature', 0, ['HotLinks', ((oldHotlinks as any)?.result?.[0] ?? true)]);

        if (stackChanger !== null) {
            try {
                void stackChanger.revert();
            } catch (e) {
                this.sendResponse(response);
                return;
            }
        }

        if (isError(maybeResult)) {
            this.sendResponse(response);
            return;
        }

        let result = maybeResult.result[0] as string;

        // eslint-disable-next-line no-control-regex
        result = result.replace(/(\[|\]|\{|\})\x08/g, '');
        result = result.trim();

        if (result === '') {
            this.sendResponse(response);
            return;
        }
        response.body = { 
            result: result,
            variablesReference: 0
        };
        response.body.type = 'string';
        response.body.presentationHint = {
            kind: 'data',
            attributes: ['rawString']
        }

        this.sendResponse(response);
    }

    protected pauseRequest (response: DebugProtocol.PauseResponse, args: DebugProtocol.PauseArguments, request?: DebugProtocol.Request): void {
        this.sendResponse(response);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    protected customRequest (command: string, response: DebugProtocol.Response, args: any, request?: DebugProtocol.Request): void {
        if (command === 'cacheFilePath') {
            this._getCanonicalPath(args.fileName).then(() => { }, () => { });
        }
        this.sendResponse(response);
    }

    private _cleanup (): void {
        this._numberOfStackFrames = -1;
        if (this._pendingSetBreakpointPromise != null) {
            this._pendingSetBreakpointPromise.reject();
            this._pendingSetBreakpointPromise = undefined;
        }
        if (this._pendingVariablesPromise != null) {
            this._pendingVariablesPromise.reject();
            this._pendingVariablesPromise = undefined;
        }
        this._breakpointChangeListeners = [];
    }

    private _handleDisconnect (): void {
        this._cleanup();

        this.sendEvent(new debug.ExitedEvent(0));
        this.sendEvent(new debug.TerminatedEvent(false));
    }

    private async _moveToFrame (frameId?: number): Promise<{ revert: () => Promise<void> } | null> {
        if (frameId === undefined) {
            return null;
        }

        try {
            await this._waitForPendingVariablesRequest();
        } catch (e) {
            return null;
        }

        const dbAmount = this._numberOfStackFrames - frameId;
        if (dbAmount !== 0) {
            try {
                if (dbAmount > 0) {
                    await this._mvm.feval<undefined>('dbup', 0, [dbAmount]);
                } else {
                    await this._mvm.feval<undefined>('dbdown', 0, [-dbAmount]);
                }
            } catch (e) {
                this._clearPendingVariablesRequest();
                throw e;
            }
        }

        return {
            revert: async () => {
                const dbAmount = this._numberOfStackFrames - frameId;
                if (dbAmount !== 0) {
                    try {
                        if (dbAmount > 0) {
                            await this._mvm.feval<undefined>('dbdown', 0, [dbAmount]);
                        } else {
                            await this._mvm.feval<undefined>('dbup', 0, [-dbAmount]);
                        }
                    } catch (e) {
                        this._clearPendingVariablesRequest();
                        return;
                    }
                }

                this._clearPendingVariablesRequest();
            }
        };
    }

    private async _getCanonicalPath (path: string): Promise<string> {
        let cachePromise: ResolvablePromise<string> | undefined = this._canonicalizedPathCache.get(path);

        if (cachePromise === undefined) {
            cachePromise = createResolvablePromise<string>();
            this._canonicalizedPathCache.set(path, cachePromise);

            let canonicalizeResult: MatlabData | MVMError;
            try {
                canonicalizeResult = await this._mvm.feval<MatlabData>('builtin', 1, ['_canonicalizepath', path]);
            } catch (e) {
                cachePromise.reject();
                this._canonicalizedPathCache.delete(path);
                return await cachePromise;
            }

            if (isError(canonicalizeResult)) {
                cachePromise.reject();
                this._canonicalizedPathCache.delete(path);
                return await cachePromise;
            }

            const resultPath = canonicalizeResult.result[0];
            cachePromise.resolve(resultPath);
            return resultPath
        } else {
            return await cachePromise;
        }
    }
}
