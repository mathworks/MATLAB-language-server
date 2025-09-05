// Copyright 2025 The MathWorks, Inc.
import sinon from 'sinon'

export default function getMockMvm (): any {
    const mockMvm = {
        waitUntilReady: sinon.stub(),
        feval: sinon.stub(),
        getMatlabRelease: sinon.stub(),

        // EventEmitter mocking
        on: (event: string, callback: () => void) => {
            mockMvm._eventCallbacks[event] = callback
        },
        _eventCallbacks: {},
        _emitEvent: (event: string, eventData: any) => {
            const callback = mockMvm._eventCallbacks[event]
            if (callback) {
                callback(eventData)
            }
        }
    }

    return mockMvm
}
