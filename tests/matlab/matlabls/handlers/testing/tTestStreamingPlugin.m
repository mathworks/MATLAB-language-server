% Copyright 2026 The MathWorks, Inc.
classdef tTestStreamingPlugin < matlab.unittest.TestCase
    properties (Access=private)
        Spy
        FailingTestFile string
        IncompleteTestFile string
    end

    methods (TestClassSetup)
        function addSourcePath(~)
            addpath("../../../../../matlab");
        end

        function createNegativeFixtures(testCase)
            fixtureDir = tempname;
            mkdir(fixtureDir);
            testCase.addTeardown(@() rmdir(fixtureDir, 's'));

            testCase.FailingTestFile = fullfile(fixtureDir, 'FailingTestClass.m');
            tTestStreamingPlugin.writeFixture(testCase.FailingTestFile, {
                'classdef FailingTestClass < matlab.unittest.TestCase'
                '    methods (Test)'
                '        function testAlwaysFails(testCase)'
                '            testCase.verifyEqual(1+1, 3);'
                '        end'
                '    end'
                'end'});

            testCase.IncompleteTestFile = fullfile(fixtureDir, 'IncompleteTestClass.m');
            tTestStreamingPlugin.writeFixture(testCase.IncompleteTestFile, {
                'classdef IncompleteTestClass < matlab.unittest.TestCase'
                '    methods (Test)'
                '        function testAssumeSkips(testCase)'
                '            testCase.assumeTrue(false);'
                '        end'
                '    end'
                'end'});
        end
    end

    methods (Static, Access=private)
        function writeFixture(filePath, lines)
            fid = fopen(filePath, 'w');
            cleanup = onCleanup(@() fclose(fid));
            for i = 1:numel(lines)
                fprintf(fid, '%s\n', lines{i});
            end
        end
    end

    methods (TestMethodSetup)
        function setupSpy(testCase)
            testCase.Spy = TestStreamingPluginSpy();
        end
    end

    methods (Test)
        function testPublishesStartedEventBeforeRunningTest(testCase)
            suite = matlab.unittest.TestSuite.fromFile(...
                fullfile(pwd, 'testData', 'SampleTestClass.m'));
            suite = suite(1); % single test

            runner = matlab.unittest.TestRunner.withNoPlugins();
            runner.addPlugin(testCase.Spy);
            runner.run(suite);

            startEvents = testCase.Spy.filterByType('started');
            testCase.verifyGreaterThanOrEqual(numel(startEvents), 1);
            testCase.verifyEqual(startEvents{1}.type, 'started');
            testCase.verifyTrue(contains(startEvents{1}.testName, 'testAddition'));
            testCase.verifyTrue(contains(startEvents{1}.testFile, 'SampleTestClass.m'));
        end

        function testPublishesFinishedEventWithPassedStatus(testCase)
            suite = matlab.unittest.TestSuite.fromFile(...
                fullfile(pwd, 'testData', 'SampleTestClass.m'));
            suite = suite(1); % testAddition — passes

            runner = matlab.unittest.TestRunner.withNoPlugins();
            runner.addPlugin(matlab.unittest.plugins.DiagnosticsRecordingPlugin);
            runner.addPlugin(testCase.Spy);
            runner.run(suite);

            finishedEvents = testCase.Spy.filterByType('finished');
            testCase.verifyGreaterThanOrEqual(numel(finishedEvents), 1);
            testCase.verifyEqual(finishedEvents{1}.type, 'finished');
            testCase.verifyEqual(finishedEvents{1}.status, 'passed');
            testCase.verifyTrue(contains(finishedEvents{1}.testName, 'testAddition'));
            testCase.verifyTrue(contains(finishedEvents{1}.testFile, 'SampleTestClass.m'));
            testCase.verifyGreaterThan(finishedEvents{1}.duration, 0);
        end

        function testPublishesFinishedEventWithFailedStatus(testCase)
            suite = matlab.unittest.TestSuite.fromFile(testCase.FailingTestFile);

            runner = matlab.unittest.TestRunner.withNoPlugins();
            runner.addPlugin(matlab.unittest.plugins.DiagnosticsRecordingPlugin);
            runner.addPlugin(testCase.Spy);
            runner.run(suite);

            finishedEvents = testCase.Spy.filterByType('finished');
            testCase.verifyGreaterThanOrEqual(numel(finishedEvents), 1);
            testCase.verifyEqual(finishedEvents{1}.status, 'failed');
            testCase.verifyTrue(contains(finishedEvents{1}.testFile, 'FailingTestClass.m'));
        end

        function testPublishesFinishedEventWithIncompleteStatus(testCase)
            suite = matlab.unittest.TestSuite.fromFile(testCase.IncompleteTestFile);

            runner = matlab.unittest.TestRunner.withNoPlugins();
            runner.addPlugin(matlab.unittest.plugins.DiagnosticsRecordingPlugin);
            runner.addPlugin(testCase.Spy);
            runner.run(suite);

            finishedEvents = testCase.Spy.filterByType('finished');
            testCase.verifyGreaterThanOrEqual(numel(finishedEvents), 1);
            testCase.verifyEqual(finishedEvents{1}.status, 'incomplete');
            testCase.verifyTrue(contains(finishedEvents{1}.testFile, 'IncompleteTestClass.m'));
        end

        function testDiagnosticsEmptyForPassingTest(testCase)
            suite = matlab.unittest.TestSuite.fromFile(...
                fullfile(pwd, 'testData', 'SampleTestClass.m'));
            suite = suite(1);

            runner = matlab.unittest.TestRunner.withNoPlugins();
            runner.addPlugin(matlab.unittest.plugins.DiagnosticsRecordingPlugin);
            runner.addPlugin(testCase.Spy);
            runner.run(suite);

            finishedEvents = testCase.Spy.filterByType('finished');
            testCase.verifyGreaterThanOrEqual(numel(finishedEvents), 1);
            testCase.verifyTrue(isempty(finishedEvents{1}.diagnostics));
        end

        function testDiagnosticsContainMessageAndLocationForFailure(testCase)
            suite = matlab.unittest.TestSuite.fromFile(testCase.FailingTestFile);

            runner = matlab.unittest.TestRunner.withNoPlugins();
            runner.addPlugin(matlab.unittest.plugins.DiagnosticsRecordingPlugin);
            runner.addPlugin(testCase.Spy);
            runner.run(suite);

            finishedEvents = testCase.Spy.filterByType('finished');
            testCase.verifyGreaterThanOrEqual(numel(finishedEvents), 1);

            diags = finishedEvents{1}.diagnostics;
            testCase.verifyFalse(isempty(diags));
            testCase.verifyNotEmpty(diags{1}.message);
            testCase.verifyNotEmpty(diags{1}.failedInFile);
            testCase.verifyGreaterThan(diags{1}.failedOnLine, 0);
        end

        function testStartedAndFinishedPublishedPerTest(testCase)
            suite = matlab.unittest.TestSuite.fromFile(...
                fullfile(pwd, 'testData', 'SampleTestClass.m'));
            % SampleTestClass has 2 tests

            runner = matlab.unittest.TestRunner.withNoPlugins();
            runner.addPlugin(testCase.Spy);
            runner.run(suite);

            startEvents = testCase.Spy.filterByType('started');
            finishedEvents = testCase.Spy.filterByType('finished');
            testCase.verifyEqual(numel(startEvents), 2);
            testCase.verifyEqual(numel(finishedEvents), 2);
        end
    end
end
