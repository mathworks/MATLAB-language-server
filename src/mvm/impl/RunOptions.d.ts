/**
 * The capabilities of the text sink
 */
export interface SinkTraits {
    _supportsMore: boolean;
    _supportsHotlinks: boolean;
    _useDiary: boolean;
    _useEcho: boolean;
    _useLogging: boolean;
}
export declare enum Capability {
    InteractiveCommandLine = "InteractiveCommandLine",
    Swing = "Swing",
    ComplexSwing = "ComplexSwing",
    LocalClient = "LocalClient",
    WebWindow = "WebWindow",
    ModalDialogs = "ModalDialogs",
    Debugging = "Debugging"
}
export declare const FullCapabilitiesList: Capability[];
/**
 * The run options for a given request
 */
export interface RunOptions {
    capabilitiesList?: string[];
    dequeueMode?: string;
    eventConnections: any;
    eventNames?: any;
    queueName?: string;
    groupNames?: string[];
    suppressDebugControlOutput?: boolean;
    errSinkTraits?: SinkTraits;
    useNullErrSink?: boolean;
    outSinkTraits?: SinkTraits;
    useNullOutSink?: boolean;
    commandWindowWidth?: number;
    commandWindowHeight?: number;
}
