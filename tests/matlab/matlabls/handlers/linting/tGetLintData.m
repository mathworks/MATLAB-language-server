% Copyright 2025 The MathWorks, Inc.
classdef tGetLintData < matlab.unittest.TestCase
    methods (TestClassSetup)
        function setup (~)
            % Add function under test to path
            addpath("../../../../../matlab");
        end
    end

    methods (Test)
        % Test a case where the diagnostic only applies to one character
        function testSingleCharLintDiagnostic (testCase)
            code = 'x = #'; % Will produce diagnostic about bad character
            fileName = 'myScript.m';

            lintData = matlabls.handlers.linting.getLintData(code, fileName);

            testCase.verifyEqual(numel(lintData), 1);
            testCase.verifySubstring(lintData{1}, 'L 1 (C 5):');
            
        end

        % Test a case where the diagnostic applies to multiple characters
        function testMultiCharLintDiagnostic (testCase)
            code = 's = "123'; % Will produce diagnostic about unterminated string
            fileName = 'myScript.m';

            lintData = matlabls.handlers.linting.getLintData(code, fileName);

            testCase.verifyEqual(numel(lintData), 1);
            testCase.verifySubstring(lintData{1}, 'L 1 (C 5-8):');
        end

        % Test a case where the diagnostic is fixable
        function testFixableLintDiagnostic (testCase)
            code = 'x = 1;;'; % Will produce fixable diagnostic about unnecessary semicolon
            fileName = 'myScript.m';

            lintData = matlabls.handlers.linting.getLintData(code, fileName);

            testCase.verifyEqual(numel(lintData), 3);

            testCase.verifySubstring(lintData{1}, 'L 1 (C 7):');
            testCase.verifySubstring(lintData{1}, '(CAN FIX)');

            testCase.verifySubstring(lintData{2}, 'FIX MESSAGE');

            testCase.verifySubstring(lintData{3}, 'CHANGE MESSAGE');
        end
    end
end
