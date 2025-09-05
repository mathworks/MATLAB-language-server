// Copyright 2025 The MathWorks, Inc.

import { Settings } from '../lifecycle/ConfigurationManager';
import MVM from '../mvm/impl/MVM';

/**
 * Handles change in Default Editor Config. Sets MATLAB as default editor on each config state change. 
 * @param configuration VS Code extension settings object 
 * @param mvm MVM object to execute 'eval' commands and update editor settings in MATLAB
 */
export async function handleDefaultEditorConfigChange (configuration: Settings, mvm: MVM): Promise<void> {
    if(!configuration.defaultEditor && mvm.isReady()) {
        await mvm.feval('matlabls.handlers.utils.defaultEditorUtils.clearTemporaryEditorSettings',
            0,
            []
        )
    }   
}

/**
 * Sets VS Code as default editor. Triggered through NotificationService channel on start-up and during user session when defaultEditor config is updated to true.
 * @param configuration VS Code extension settings object 
 * @param mvm MVM object to execute 'eval' commands and update editor settings in MATLAB
 * @param executablePath Path to VS Code executable
 */
export async function setDefaultEditorVsCode (configuration: Settings, mvm: MVM, executablePath: String): Promise<void> {
    if (configuration.defaultEditor && executablePath.length > 0 && mvm.isReady()) {
        await mvm.feval('matlabls.handlers.utils.defaultEditorUtils.setTemporaryEditorSettings',
            0,
            [executablePath]
        )
    } 
}