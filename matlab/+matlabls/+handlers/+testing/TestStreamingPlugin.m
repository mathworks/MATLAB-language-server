classdef TestStreamingPlugin < matlab.unittest.plugins.TestRunnerPlugin
    % Copyright 2026 The MathWorks, Inc.

    properties (Access=private)
        ResponseChannel string
    end

    methods
        function plugin = TestStreamingPlugin(responseChannel)
            plugin.ResponseChannel = responseChannel;
        end
    end

    methods (Access=protected)
        function runTest(plugin, pluginData)
            startEvent.type = 'started';
            startEvent.testName = char(pluginData.Name);
            startEvent.testFile = getTestFile(pluginData);
            plugin.publishEvent(startEvent);

            runTest@matlab.unittest.plugins.TestRunnerPlugin(plugin, pluginData);
        end

        function reportFinalizedResult(plugin, pluginData)
            testResult = pluginData.TestResult;

            event.type = 'finished';
            event.testName = char(pluginData.Name);
            event.testFile = getTestFile(pluginData);
            event.status = getStatusString(testResult);
            event.duration = testResult.Duration;
            event.diagnostics = extractDiagnostics(testResult);

            plugin.publishEvent(event);

            reportFinalizedResult@matlab.unittest.plugins.TestRunnerPlugin(plugin, pluginData);
        end

        function publishEvent(plugin, event)
            matlabls.internal.CommunicationManager.publish(plugin.ResponseChannel, event);
        end
    end
end


function testFile = getTestFile(pluginData)
    ts = pluginData.TestSuite;
    tc = ts.TestClass;
    if strlength(tc) > 0
        testFile = fullfile(char(ts.BaseFolder), [char(tc) '.m']);
    else
        parts = strsplit(char(pluginData.Name), '/');
        testFile = fullfile(char(ts.BaseFolder), [parts{1} '.m']);
    end
end


function status = getStatusString(result)
    if result.Passed
        status = 'passed';
    elseif result.Failed
        status = 'failed';
    else
        status = 'incomplete';
    end
end


function diags = extractDiagnostics(result)
    diags = {};
    if result.Passed
        return;
    end

    details = result.Details;
    if ~isfield(details, 'DiagnosticRecord') || isempty(details.DiagnosticRecord)
        return;
    end

    records = details.DiagnosticRecord;
    diags = cell(1, numel(records));
    for i = 1:numel(records)
        d.message = char(records(i).Report);
        if ~isempty(records(i).Stack)
            d.failedInFile = char(records(i).Stack(1).file);
            d.failedOnLine = records(i).Stack(1).line;
            stackFrames = cell(1, numel(records(i).Stack));
            for j = 1:numel(records(i).Stack)
                frame.file = char(records(i).Stack(j).file);
                frame.name = char(records(i).Stack(j).name);
                frame.line = records(i).Stack(j).line;
                stackFrames{j} = frame;
            end
            d.stack = stackFrames;
        else
            d.failedInFile = '';
            d.failedOnLine = 0;
            d.stack = {};
        end
        diags{i} = d;
    end
end
