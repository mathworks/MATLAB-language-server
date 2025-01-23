// Copyright 2024-2025 The MathWorks, Inc.

import { IMVM } from '../mvm/impl/MVM'
import EventEmitter from 'events';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MatlabData = any;

export class BreakpointInfo {
    filePath: string;
    lineNumber: number;
    anonymousFunctionIndex: number;
    condition?: string;
    enabled: boolean;

    constructor (filePath: string, lineNumber: number, condition: string | undefined, anonymousFunctionIndex: number) {
        this.filePath = filePath;
        this.lineNumber = lineNumber;
        this.condition = condition === '' ? undefined : condition;
        this.anonymousFunctionIndex = 0;
        this.enabled = condition === undefined || !(condition === 'false' || /$false && \(.*\)^/.test(condition));
    }

    equals (other: BreakpointInfo, ignoreCondition: boolean): boolean {
        const result = other.filePath === this.filePath && other.lineNumber === this.lineNumber && other.anonymousFunctionIndex === this.anonymousFunctionIndex;
        if (!result || ignoreCondition) {
            return result;
        } else {
            return this.condition === other.condition;
        }
    }
}

export enum GlobalBreakpointType {
    ERROR = 'ERROR',
    CAUGHT_ERROR = 'CAUGHT_ERROR',
    WARNING = 'WARNING',
    NAN_INF = 'NAN_INF'
}

export class GlobalBreakpointInfo {
    static TypeMap: {[index: string | number]: GlobalBreakpointType} = {
        0: GlobalBreakpointType.ERROR,
        1: GlobalBreakpointType.CAUGHT_ERROR,
        2: GlobalBreakpointType.WARNING,
        3: GlobalBreakpointType.NAN_INF,
        error: GlobalBreakpointType.ERROR,
        'caught error': GlobalBreakpointType.CAUGHT_ERROR,
        warning: GlobalBreakpointType.WARNING,
        naninf: GlobalBreakpointType.NAN_INF,
        [GlobalBreakpointType.ERROR]: GlobalBreakpointType.ERROR,
        [GlobalBreakpointType.CAUGHT_ERROR]: GlobalBreakpointType.CAUGHT_ERROR,
        [GlobalBreakpointType.WARNING]: GlobalBreakpointType.WARNING,
        [GlobalBreakpointType.NAN_INF]: GlobalBreakpointType.NAN_INF
    }

    type: GlobalBreakpointType;
    identifiers: string[];

    constructor (type: GlobalBreakpointType, identifiers: string[]) {
        this.type = type;
        this.identifiers = identifiers;
    }
}

enum Events {
    DBEnter = 'DBEnter',
    DBStop = 'DBStop',
    DBExit = 'DBExit',
    DBCont = 'DBCont',
    DBWorkspaceChanged = 'DBWorkspaceChanged',
    BreakpointAdded = 'BreakpointAdded',
    BreakpointRemoved = 'BreakpointRemoved',
    BreakpointsCleared = 'BreakpointsCleared',
    GlobalBreakpointAdded = 'GlobalBreakpointAdded',
    GlobalBreakpointRemoved = 'GlobalBreakpointRemoved'
}

export class DebugServices extends EventEmitter {
    static Events = Events;
    private readonly _mvm: IMVM;

    constructor (mvm: IMVM) {
        super();
        this._mvm = mvm;
        this._setupListeners();
    }

    private _setupListeners (): void {
        this._mvm.on('EnterDebuggerEvent', this._handleEnterEvent.bind(this));
        this._mvm.on('EnterDebuggerWithWarningEvent', this._handleEnterEvent.bind(this));
        this._mvm.on('ExitDebuggerEvent', this._handleExitEvent.bind(this));
        this._mvm.on('ContinueExecutionEvent', (data: MatlabData) => {
            this.emit(DebugServices.Events.DBCont);
        });
        this._mvm.on('ChangeCurrentWorkspaceEvent', (data: MatlabData) => {
            this.emit(DebugServices.Events.DBWorkspaceChanged);
        });
        this._mvm.on('AddLineNumberBreakpointEvent', (data: MatlabData) => {
            this.emit(DebugServices.Events.BreakpointAdded, new BreakpointInfo(data.Filespec, data.LineNumber, data.Condition, data.whichAnonymousFunctionOnCurrentLine));
        });
        this._mvm.on('DeleteLineNumberBreakpointEvent', (data: MatlabData) => {
            this.emit(DebugServices.Events.BreakpointRemoved, new BreakpointInfo(data.Filespec, data.LineNumber, data.Condition, data.whichAnonymousFunctionOnCurrentLine));
        });
        this._mvm.on('DeleteAllBreakpointsEvent', () => {
            this.emit(DebugServices.Events.BreakpointsCleared);
        });
        this._mvm.on('AddProgramWideBreakpointEvent', (data: MatlabData) => {
            this.emit(DebugServices.Events.GlobalBreakpointAdded, new GlobalBreakpointInfo(GlobalBreakpointInfo.TypeMap[data.programWideTag], data.messageIdentifier === 'all' ? [] : [data.messageIdentifier]));
        });
        this._mvm.on('DeleteProgramWideBreakpointEvent', (data: MatlabData) => {
            this.emit(DebugServices.Events.GlobalBreakpointRemoved, new GlobalBreakpointInfo(GlobalBreakpointInfo.TypeMap[data.programWideTag], data.messageIdentifier === 'all' ? [] : [data.messageIdentifier]));
        });
    }

    private _isSessionLevelEvent (eventData: MatlabData): boolean {
        if (this._mvm.getMatlabRelease() === 'R2021b') {
            return eventData.DebugNestLevel >= 3;
        } else {
            return eventData.DebugNestLevel === 2;
        }
    }

    private _handleEnterEvent (data: MatlabData): void {
        if (this._isSessionLevelEvent(data)) {
            this.emit(DebugServices.Events.DBEnter);
        } else {
            const filepath = data.Filespec;
            const lineNumber = (data.IsAtEndOfFunction as boolean) ? -data.LineNumber : data.LineNumber;
            this.emit(DebugServices.Events.DBStop, filepath, lineNumber, data.Stack ?? []);
        }
    }

    private _handleExitEvent (data: MatlabData): void {
        if (this._isSessionLevelEvent(data)) {
            this.emit(DebugServices.Events.DBExit, data.IsDebuggerActive);
        }
    }
}
