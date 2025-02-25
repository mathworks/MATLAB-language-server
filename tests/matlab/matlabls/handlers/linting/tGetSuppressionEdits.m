% Copyright 2025 The MathWorks, Inc.
classdef tGetSuppressionEdits < matlab.unittest.TestCase
    methods (TestClassSetup)
        function setup (~)
            % Add function under test to path
            addpath("../../../../../matlab");
        end
    end

    methods (Test)
        % Test a basic case where a suppression should be placed on the same line
        function testBasicSuppression (testCase)
            code = sprintf('if true\n    x = 3;\nend');
            diagnosticId = 'testId';
            diagnosticLine = 2;
            suppressInFile = false;

            expectedRange = struct('start', struct('line', 1, 'character', 10), 'end', struct('line', 1, 'character', 10));
            expected = { struct('range', expectedRange, 'newText', ' %#ok<testId>') };
            actual = matlabls.handlers.linting.getSuppressionEdits(code, diagnosticId, diagnosticLine, suppressInFile);

            testCase.verifyEqual(actual, expected);
        end

        % Test a basic case where a file-wide suppression should be placed on the same line
        function testBasicSuppressionInFile (testCase)
            code = sprintf('if true\n    x = 3;\nend');
            diagnosticId = 'testId';
            diagnosticLine = 2;
            suppressInFile = true;

            expectedRange = struct('start', struct('line', 1, 'character', 10), 'end', struct('line', 1, 'character', 10));
            expected = { struct('range', expectedRange, 'newText', ' %#ok<*testId>') };
            actual = matlabls.handlers.linting.getSuppressionEdits(code, diagnosticId, diagnosticLine, suppressInFile);

            testCase.verifyEqual(actual, expected);
        end

        % Test that suppression does not have preceding whitespace when there is trailing whitespace on line
        function testSuppressionWithTrailingSpace (testCase)
            code = sprintf('if true\n    x = 3;  \nend');
            diagnosticId = 'testId';
            diagnosticLine = 2;
            suppressInFile = false;

            expectedRange = struct('start', struct('line', 1, 'character', 12), 'end', struct('line', 1, 'character', 12));
            expected = { struct('range', expectedRange, 'newText', '%#ok<testId>') };
            actual = matlabls.handlers.linting.getSuppressionEdits(code, diagnosticId, diagnosticLine, suppressInFile);

            testCase.verifyEqual(actual, expected);
        end

        % Test a case where a suppression should be placed at the end of a multi-line statement
        function testSuppressionAfterMultilineStatement (testCase)
            code = sprintf('if true\n    x = 1 + ...\n        2 + ...\n        3;\nend');
            diagnosticId = 'testId';
            diagnosticLine = 2;
            suppressInFile = false;

            expectedRange = struct('start', struct('line', 3, 'character', 10), 'end', struct('line', 3, 'character', 10));
            expected = { struct('range', expectedRange, 'newText', ' %#ok<testId>') };
            actual = matlabls.handlers.linting.getSuppressionEdits(code, diagnosticId, diagnosticLine, suppressInFile);

            testCase.verifyEqual(actual, expected);
        end
    end
end
