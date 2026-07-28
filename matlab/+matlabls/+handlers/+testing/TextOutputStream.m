classdef TextOutputStream < matlab.unittest.plugins.OutputStream
    % Publishes printed text to a channel for streaming to VS Code.

    % Copyright 2026 The MathWorks, Inc.

    properties (Access=private)
        ResponseChannel string
    end

    methods
        function stream = TextOutputStream(responseChannel)
            stream.ResponseChannel = responseChannel;
        end

        function print(stream, formatSpec, varargin)
            text = sprintf(formatSpec, varargin{:});
            event.type = 'output';
            event.text = text;
            stream.publishEvent(event);
        end
    end

    methods (Access=protected)
        function publishEvent(stream, event)
            matlabls.internal.CommunicationManager.publish(stream.ResponseChannel, event);
        end
    end
end
