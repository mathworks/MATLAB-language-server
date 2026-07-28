classdef TestStreamingPluginSpy < matlabls.handlers.testing.TestStreamingPlugin
    % Spy subclass that captures published events instead of sending them
    % to CommunicationManager.

    % Copyright 2026 The MathWorks, Inc.

    properties
        CapturedEvents cell = {}
    end

    methods
        function plugin = TestStreamingPluginSpy()
            plugin@matlabls.handlers.testing.TestStreamingPlugin('');
        end

        function events = filterByType(plugin, type)
            mask = cellfun(@(e) strcmp(e.type, type), plugin.CapturedEvents);
            events = plugin.CapturedEvents(mask);
        end
    end

    methods (Access=protected)
        function publishEvent(plugin, event)
            plugin.CapturedEvents{end+1} = event;
        end
    end
end
