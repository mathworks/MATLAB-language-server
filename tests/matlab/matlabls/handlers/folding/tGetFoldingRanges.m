% Copyright 2025 The MathWorks, Inc.
classdef tGetFoldingRanges < matlab.unittest.TestCase
    methods (TestClassSetup)
        function isApplicable (testCase)
            % Determine if the test should be skipped in the current environment
            testCase.assumeTrue(...
                ~isMATLABReleaseOlderThan('R2024b'),...
                "Code folding only supported in R2024b and later.");
        end

        function setup (~)
            % Add function under test to path
            addpath("../../../../../matlab");
        end
    end

    methods (Test)
        % Test a basic case (if-statement) where code folding should be present
        function testBasicFolding (testCase)
            if isMATLABReleaseOlderThan('R2024b')
                % Code folding only supported in R2024b and later
                testCase.verifyTrue(true);
                return;
            end

            code = sprintf('if true\nx = 1;\nend');
            
            expected = [1, 3];
            actual = matlabls.handlers.folding.getFoldingRanges(code);

            testCase.verifyEqual(actual, expected);
        end

        % Test a case with nested code folding
        function testNestedFolding (testCase)
            if isMATLABReleaseOlderThan('R2024b')
                % Code folding only supported in R2024b and later
                testCase.verifyTrue(true);
                return;
            end

            code = sprintf('if a == 1\nx = 1;\nif b == 1\nif c == 3\nx = 2;\nend\nend\nif d == 3\nx = 3;\nend\nend');

            expected = [1, 11, 3, 7, 4, 6, 8, 10];
            actual = matlabls.handlers.folding.getFoldingRanges(code);

            testCase.verifyEqual(actual, expected);
        end
    end
end
