% Copyright 2026 The MathWorks, Inc.
classdef tDiscoverTests < matlab.unittest.TestCase
    methods (TestClassSetup)
        function setup (~)
            addpath("../../../../../matlab");
        end
    end

    methods (Test)
        function testDiscoverFromFile(testCase)
            testFile = fullfile(pwd, 'testData', 'SampleTestClass.m');

            result = matlabls.handlers.testing.discoverTests({testFile}, 'file');

            testCase.verifyEmpty(result.error);
            testCase.verifyEqual(numel(result.names), 2);
            testCase.verifyTrue(any(contains(result.procedureNames, 'testAddition')));
            testCase.verifyTrue(any(contains(result.procedureNames, 'testSubtraction')));
            testCase.verifyTrue(all(contains(result.filenames, 'SampleTestClass.m')));
        end

        function testDiscoverFromFolder(testCase)
            testFolder = fullfile(pwd, 'testData');

            result = matlabls.handlers.testing.discoverTests({testFolder}, 'folder');

            testCase.verifyEmpty(result.error);
            testCase.verifyEqual(numel(result.names), 7);
            testCase.verifyTrue(any(contains(result.filenames, 'SampleTestClass.m')));
            testCase.verifyTrue(any(contains(result.filenames, 'ParameterizedTestClass.m')));
        end

        function testDiscoverParameterizedTests(testCase)
            testFile = fullfile(pwd, 'testData', 'ParameterizedTestClass.m');

            result = matlabls.handlers.testing.discoverTests({testFile}, 'file');

            testCase.verifyEmpty(result.error);
            testCase.verifyEqual(numel(result.names), 3);
            testCase.verifyTrue(all(contains(result.procedureNames, 'testWithParam')));
            nonEmpty = ~cellfun(@isempty, result.parameterizations);
            testCase.verifyTrue(all(nonEmpty));
        end

        function testDiscoverNonTestFileReturnsEmpty(testCase)
            testFile = fullfile(pwd, 'testData', 'NotATestClass.m');

            result = matlabls.handlers.testing.discoverTests({testFile}, 'file');

            testCase.verifyEmpty(result.names);
        end

        function testDiscoverEmptyFolderReturnsEmpty(testCase)
            emptyFolder = tempname;
            mkdir(emptyFolder);

            result = matlabls.handlers.testing.discoverTests({emptyFolder}, 'folder');

            testCase.verifyEmpty(result.names);
            rmdir(emptyFolder, 's');
        end

        function testDiscoverNonexistentPathReturnsError(testCase)
            result = matlabls.handlers.testing.discoverTests({'/nonexistent/path'}, 'folder');

            testCase.verifyNotEmpty(result.error);
        end

        function testDiscoverMultipleFiles(testCase)
            file1 = fullfile(pwd, 'testData', 'SampleTestClass.m');
            file2 = fullfile(pwd, 'testData', 'ParameterizedTestClass.m');

            result = matlabls.handlers.testing.discoverTests({file1, file2}, 'file');

            testCase.verifyEmpty(result.error);
            testCase.verifyEqual(numel(result.names), 5);
        end

        function testResultFieldsAreCorrectSize(testCase)
            testFile = fullfile(pwd, 'testData', 'SampleTestClass.m');

            result = matlabls.handlers.testing.discoverTests({testFile}, 'file');

            n = numel(result.names);
            testCase.verifyEqual(numel(result.filenames), n);
            testCase.verifyEqual(numel(result.procedureNames), n);
            testCase.verifyEqual(numel(result.testParentNames), n);
            testCase.verifyEqual(numel(result.parameterizations), n);
        end

        function testDiscoverFunctionBasedTests(testCase)
            testFile = fullfile(pwd, 'testData', 'functionBasedTest.m');

            result = matlabls.handlers.testing.discoverTests({testFile}, 'file');

            testCase.verifyEmpty(result.error);
            testCase.verifyEqual(numel(result.names), 2);
            testCase.verifyTrue(any(contains(result.procedureNames, 'testSomething')));
            testCase.verifyTrue(any(contains(result.procedureNames, 'testAnotherThing')));
            % Function-based tests should have functionBasedTest as parent name
            testCase.verifyTrue(all(contains(result.testParentNames, 'functionBasedTest')));
            testCase.verifyTrue(all(contains(result.filenames, 'functionBasedTest.m')));
        end
    end
end
