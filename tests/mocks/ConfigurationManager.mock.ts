// Copyright 2025 The MathWorks, Inc.
import sinon from 'sinon'

export default function getMockConfigurationManager (): any {
    const mockConfigurationManager = {
        getConfiguration: sinon.stub(),

        // Setting changed mocking
        addSettingCallback: (settingName: string, callback: (config: any) => void) => {
            mockConfigurationManager._settingCallbacks[settingName] = callback
        },
        _settingCallbacks: {},
        _triggerSettingCallback: (settingName: string, config: any) => {
            const callback = mockConfigurationManager._settingCallbacks[settingName]
            if (callback) {
                callback(config)
            }
        }
    }

    return mockConfigurationManager
}
