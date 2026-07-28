function runTests(testFiles, testNames, responseChannel)
    %RUNTESTS Run MATLAB unit tests with streaming results.
    %   testFiles       - cell array of absolute file paths
    %   testNames       - cell array of specific test names (empty = run all)
    %   responseChannel - Faye channel for publishing per-test events

    % Copyright 2026 The MathWorks, Inc.

    try
        suites = cell(1, numel(testFiles));
        for i = 1:numel(testFiles)
            try
                suites{i} = matlab.unittest.TestSuite.fromFile(testFiles{i});
            catch
                suites{i} = matlab.unittest.TestSuite.empty;
            end
        end
        suite = [suites{:}];

        % Filter to specific test names if provided
        if ~isempty(testNames)
            mask = ismember({suite.Name}, testNames);
            suite = suite(mask);
        end

        if isempty(suite)
            completeEvent.type = 'complete';
            matlabls.internal.CommunicationManager.publish(responseChannel, completeEvent);
            return;
        end

        % Create runner with diagnostics recording and streaming plugin
        runner = matlab.unittest.TestRunner.withNoPlugins();
        runner.addPlugin(matlab.unittest.plugins.DiagnosticsRecordingPlugin);
        runner.addPlugin(matlabls.handlers.testing.TestStreamingPlugin(responseChannel));
        outputStream = matlabls.handlers.testing.TextOutputStream(responseChannel);
        runner.addPlugin(matlab.unittest.plugins.TestRunProgressPlugin.withVerbosity(2, outputStream));
        runner.addPlugin(matlab.unittest.plugins.DiagnosticsOutputPlugin(outputStream));

        runner.run(suite);
    catch
        % Interrupted or unexpected error — fall through to complete event
    end

    completeEvent.type = 'complete';
    matlabls.internal.CommunicationManager.publish(responseChannel, completeEvent);
end
