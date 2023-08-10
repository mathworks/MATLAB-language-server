/// <reference types="node" />
import { ChildProcess } from 'child_process';
declare const Faye: any;
declare type Client = typeof Faye.Client;
declare type Subscription = typeof Faye.Client.Subscription;
export declare enum LifecycleEventType {
    CONNECTED = 0,
    DISCONNECTED = 1
}
interface MatlabProcessInfo {
    matlabProcess: ChildProcess;
    matlabConnection: MatlabConnection;
}
/**
 * Manages launching and communicating with MATLAB
 */
declare class MatlabCommunicationManager {
    /**
     * Launches and connects to MATLAB.
     *
     * @param launchCommand The command with which MATLAB is launched
     * @param launchArguments The arguments with which MATLAB is launched
     * @param logDirectory The directory in which MATLAB should log data
     *
     * @returns Information about the new MATLAB process and the connection to it.
     * Returns null if the MATLAB process cannot be started.
     */
    connectToNewMatlab(launchCommand: string, launchArguments: string[], logDirectory: string): Promise<MatlabProcessInfo | null>;
    /**
     * Attempts to connect to an existing instance of MATLAB at the given URL.
     *
     * @param url The URL at which to find MATLAB
     * @returns The connection to MATLAB
     */
    connectToExistingMatlab(url: string): Promise<MatlabConnection>;
    /**
     * Gets a random available TCP port.
     *
     * @returns A random available TCP port, as a string
     */
    private _getAvailablePort;
    /**
     * Gets a random API key for MATLAB.
     *
     * @returns A random API key
     */
    private _makeApiKey;
}
declare type LifecycleListenerCallback = (eventType: LifecycleEventType) => void;
/**
 * Abstract class representing a connection with the MATLAB application.
 */
export declare abstract class MatlabConnection {
    protected _client?: Client;
    protected _url?: string;
    protected _lifecycleCallback: LifecycleListenerCallback | null;
    /**
     * Initializes the connection with MATLAB
     */
    abstract initialize(): Promise<void>;
    /**
     * Closes the connection with MATLAB.
     * Does not attempt to close MATLAB.
     */
    close(): void;
    /**
     * Publishes a message to the given channel.
     *
     * @param channel The channel to which the message is being published
     * @param message The message being published
     */
    publish(channel: string, message: unknown): void;
    /**
     * Subscribe to messages published on the given channel. The messages will
     * be passed to hte given calback function.
     *
     * @param channel The channel for which to subscribe
     * @param callback The callback function
     * @returns The subscription object
     */
    subscribe(channel: string, callback: (message: unknown) => void): Subscription;
    /**
     * Unsubscribe from the given subscription.
     *
     * @param subscription The subscription which is being unsubscribed
     */
    unsubscribe(subscription: Subscription): void;
    /**
     * Sets a lifecycle listened callback. This will be called when there are
     * changes to the state of the connection with MATLAB.
     *
     * @param callback The callback function
     */
    setLifecycleListener(callback: LifecycleListenerCallback): void;
    protected onConnectionSuccess(): void;
    protected onConnectionFailure(): void;
    protected setupConnectionCallbacks(): void;
    /**
     * Prepends a channel name with '/matlab' as expected by MATLAB
     *
     * @param channel A channel name, in the format '/message/channel'
     * @returns A channel prepended with '/matlab', such as '/matlab/message/channel'
     */
    private _prependChannel;
}
declare const _default: MatlabCommunicationManager;
export default _default;
