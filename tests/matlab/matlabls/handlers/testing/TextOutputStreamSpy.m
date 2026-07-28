classdef TextOutputStreamSpy < matlabls.handlers.testing.TextOutputStream
    % Spy subclass that captures published events instead of sending them
    % to CommunicationManager.

    % Copyright 2026 The MathWorks, Inc.

    properties
        CapturedEvents cell = {}
    end

    methods (Access=protected)
        function publishEvent(stream, event)
            stream.CapturedEvents{end+1} = event;
        end
    end
end
