% Copyright 2025 The MathWorks, Inc.
classdef tFormatCode < matlab.unittest.TestCase
    properties (Constant)
        CodeToFormat = sprintf('if true\nx = 1;\nif true\ny = 2;\nend\nend');
    end

    methods (TestClassSetup)
        function setup (~)
            % Add function under test to path
            addpath("../../../../../matlab");
        end
    end

    methods (Test)
        % Test correct formatting with spaces when the tab size is 4.
        % Each indent should be represented by 4 spaces.
        function testFormatting4WithSpaces (testCase)
            if shouldSkipTest()
                disp('Skipping test due to environment limitations.');
                testCase.verifyTrue(true);
                return;
            end

            options.insertSpaces = true;
            options.tabSize = 4;

            expected = sprintf('if true\n    x = 1;\n    if true\n        y = 2;\n    end\nend');
            actual = matlabls.handlers.formatting.formatCode(testCase.CodeToFormat, options);

            testCase.verifyEqual(actual, expected);
        end

        % Test correct formatting with tabs when the tab size is 4.
        % Each indent should be represented by 1 tab character.
        function testFormatting4WithTabs (testCase)
            if shouldSkipTest()
                disp('Skipping test due to environment limitations.');
                testCase.verifyTrue(true);
                return;
            end

            options.insertSpaces = false;
            options.tabSize = 4;

            expected = sprintf('if true\n\tx = 1;\n\tif true\n\t\ty = 2;\n\tend\nend');
            actual = matlabls.handlers.formatting.formatCode(testCase.CodeToFormat, options);

            testCase.verifyEqual(actual, expected);
        end

        % Test correct formatting with spaces when the tab size is 6.
        % Each indent should be represented by 6 spaces.
        function testFormatting6WithSpaces (testCase)
            if shouldSkipTest()
                disp('Skipping test due to environment limitations.');
                testCase.verifyTrue(true);
                return;
            end

            options.insertSpaces = true;
            options.tabSize = 6;

            expected = sprintf('if true\n      x = 1;\n      if true\n            y = 2;\n      end\nend');
            actual = matlabls.handlers.formatting.formatCode(testCase.CodeToFormat, options);

            testCase.verifyEqual(actual, expected);
        end

        % Test correct formatting with tabs when the tab size is 6.
        % Each indent should be represented by 1 tab character.
        function testFormatting6WithTabs (testCase)
            if shouldSkipTest()
                disp('Skipping test due to environment limitations.');
                testCase.verifyTrue(true);
                return;
            end

            options.insertSpaces = false;
            options.tabSize = 4;

            expected = sprintf('if true\n\tx = 1;\n\tif true\n\t\ty = 2;\n\tend\nend');
            actual = matlabls.handlers.formatting.formatCode(testCase.CodeToFormat, options);

            testCase.verifyEqual(actual, expected);
        end
    end
end

function shouldSkip = shouldSkipTest ()
    % Before 25a, code formatting depends on Java logic, which may not be available
    % in the testing environment.
    shouldSkip = isMATLABReleaseOlderThan('R2025a') && ~isempty(javachk('swing'));
end
