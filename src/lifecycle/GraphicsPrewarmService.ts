// Copyright 2025 The MathWorks, Inc.

import Logger from '../logging/Logger';
import MVM, { IMVM, MatlabState } from '../mvm/impl/MVM';
import { ConfigurationManager } from './ConfigurationManager';

/**
 * Handles prewarming MATLAB graphics to boost the performance of the first figure window when
 * connecting to MATLAB R2025a and later.
 */
export default class GraphicsPrewarmService {
    hasPrewarmed = false

    constructor (private readonly mvm: MVM, private readonly configurationManager: ConfigurationManager) {
        // Listen to MATLAB state changes to trigger prewarm when ready
        this.mvm.on(IMVM.Events.stateChange, state => this.handleMvmStateChange(state))

        // Listen to changes to the prewarmGraphics configuration
        this.configurationManager.addSettingCallback(
            'prewarmGraphics',
            configuration => this.handleSettingChanged(configuration.prewarmGraphics)
        )
    }

    /**
     * Reacts to changes in the MVM state.
     *
     * @param state The MVM state
     */
    private async handleMvmStateChange (state: MatlabState): Promise<void> {
        if (state === MatlabState.READY) {
            await this.handleMatlabConnectionReady()
        } else if (state === MatlabState.DISCONNECTED) {
            // Reset hasPrewarmed flag when MATLAB is disconnected
            this.hasPrewarmed = false
        }
    }

    /**
     * Reacts to the MATLAB connection becoming ready. If the graphics prewarm is
     * enabled and has not yet been performed, this will trigger the graphics prewarm.
     */
    private async handleMatlabConnectionReady (): Promise<void> {
        if (this.hasPrewarmed) {
            // Return early if already prewarmed
            return
        }

        const prewarmGraphics = (await this.configurationManager.getConfiguration()).prewarmGraphics

        if (prewarmGraphics) {
            this.prewarmGraphics()
        }
    }

    /**
     * Reacts to changes in the `prewarmGraphics` setting.
     *
     * @param newValue The new value of the `prewarmGraphics` setting
     */
    private handleSettingChanged (newValue: boolean): void {
        if (newValue && !this.hasPrewarmed) {
            this.prewarmGraphics()
        }
    }

    /**
     * For MATLAB R2025a and later, prewarms the graphics by loading the MATLAB desktop in the background.
     * This boosts the rendering performance for the first figure window by doing this work early.
     * 
     * For MATLAB releases earlier than R2025a, this is a no-op.
     */
    private prewarmGraphics (): void {
        const matlabRelease = this.mvm.getMatlabRelease()
        if (matlabRelease == null || matlabRelease === '') {
            // Not currently connected to MATLAB or unable
            // to determine release number - no-op
            return
        }

        if (matlabRelease >= 'R2025a') {
            // This is only needed in R2025a and later
            this.mvm.feval('matlab.desktop.internal.webdesktop', 0, ['-hidden'])
            Logger.log('Prewarming graphics')
        }
        this.hasPrewarmed = true
    }
}
