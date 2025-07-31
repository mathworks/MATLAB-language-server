% Copyright 2025 The MathWorks, Inc.
classdef tFormatCode < matlab.unittest.TestCase
    properties (Constant)
        CodeSnippet1 = sprintf('if true\nx = 1;\nif true\ny = 2;\nend\nend');
        CodeSnippet2 = sprintf('if true\nif true\n \t if true\n\tx = 3;\nend\nend\n    end');
    end

    methods (TestClassSetup)
        function isApplicable (testCase)
            % Determine if the test should be skipped in the current environment
            isTestingEnvironment = ~isempty(getenv('MATLAB_TEST_ENVIRONMENT'));
            shouldRun = ~(isMATLABReleaseOlderThan('R2024b') && isTestingEnvironment);

            testCase.assumeTrue(...
                shouldRun,...
                "Document formatting test cannot run prior to 24b in GitHub test environment.");
        end

        function setup (~)
            % Add function under test to path
            addpath("../../../../../matlab");
        end
    end

    % Tests for full-document formatting functionality
    methods (Test)
        % Test correct formatting with spaces when the tab size is 4.
        % Each indent should be represented by 4 spaces.
        function testFormatting4WithSpaces_fullDocument (testCase)
            options.insertSpaces = true;
            options.tabSize = 4;

            expected = sprintf('if true\n    x = 1;\n    if true\n        y = 2;\n    end\nend');
            actual = matlabls.handlers.formatting.formatCode(testCase.CodeSnippet1, 0, 5, options);

            testCase.verifyEqual(actual, expected);
        end

        % Test correct formatting with tabs when the tab size is 4.
        % Each indent should be represented by 1 tab character.
        function testFormatting4WithTabs_fullDocument (testCase)
            options.insertSpaces = false;
            options.tabSize = 4;

            expected = sprintf('if true\n\tx = 1;\n\tif true\n\t\ty = 2;\n\tend\nend');
            actual = matlabls.handlers.formatting.formatCode(testCase.CodeSnippet1, 0, 5, options);

            testCase.verifyEqual(actual, expected);
        end

        % Test correct formatting with spaces when the tab size is 6.
        % Each indent should be represented by 6 spaces.
        function testFormatting6WithSpaces_fullDocument (testCase)
            options.insertSpaces = true;
            options.tabSize = 6;

            expected = sprintf('if true\n      x = 1;\n      if true\n            y = 2;\n      end\nend');
            actual = matlabls.handlers.formatting.formatCode(testCase.CodeSnippet1, 0, 5, options);

            testCase.verifyEqual(actual, expected);
        end

        % Test correct formatting with tabs when the tab size is 6.
        % Each indent should be represented by 1 tab character.
        function testFormatting6WithTabs_fullDocument (testCase)
            options.insertSpaces = false;
            options.tabSize = 6;

            expected = sprintf('if true\n\tx = 1;\n\tif true\n\t\ty = 2;\n\tend\nend');
            actual = matlabls.handlers.formatting.formatCode(testCase.CodeSnippet1, 0, 5, options);

            testCase.verifyEqual(actual, expected);
        end
    end

    % Tests for partial-document formatting functionality
    methods (Test)
        % Test correct formatting with spaces when the tab size is 4.
        % Each indent should be represented by 4 spaces.
        function testFormatting4WithSpaces_partialDocument (testCase)
            options.insertSpaces = true;
            options.tabSize = 4;

            expected = sprintf('if true\n    if true\n        if true\n            x = 3;\n        end\nend\n    end');
            actual = matlabls.handlers.formatting.formatCode(testCase.CodeSnippet2, 1, 4, options);

            testCase.verifyEqual(actual, expected);
        end

        % Test correct formatting with tabs when the tab size is 4.
        % Each indent should be represented by 1 tab character.
        function testFormatting4WithTabs_partialDocument (testCase)
            options.insertSpaces = false;
            options.tabSize = 4;

            expected = sprintf('if true\n\tif true\n\t\tif true\n\t\t\tx = 3;\n\t\tend\nend\n    end');
            actual = matlabls.handlers.formatting.formatCode(testCase.CodeSnippet2, 1, 4, options);

            testCase.verifyEqual(actual, expected);
        end

        % Test correct formatting with spaces when the tab size is 6.
        % Each indent should be represented by 6 spaces.
        function testFormatting6WithSpaces_partialDocument (testCase)
            options.insertSpaces = true;
            options.tabSize = 6;

            expected = sprintf('if true\n      if true\n            if true\n                  x = 3;\n            end\nend\n    end');
            actual = matlabls.handlers.formatting.formatCode(testCase.CodeSnippet2, 1, 4, options);

            testCase.verifyEqual(actual, expected);
        end

        % Test correct formatting with tabs when the tab size is 6.
        % Each indent should be represented by 1 tab character.
        function testFormatting6WithTabs_partialDocument (testCase)
            options.insertSpaces = false;
            options.tabSize = 6;

            expected = sprintf('if true\n\tif true\n\t\tif true\n\t\t\tx = 3;\n\t\tend\nend\n    end');
            actual = matlabls.handlers.formatting.formatCode(testCase.CodeSnippet2, 1, 4, options);

            testCase.verifyEqual(actual, expected);
        end

        % Test that formatted lines are correctly aligned with the surrounding code.
        % Each indent should be prepresented by 4 spaces.
        function testAlignIndent4WithSpaces_partialDocument (testCase)
            options.insertSpaces = true;
            options.tabSize = 4;

            expected = sprintf('if true\nif true\n \t if true\n         x = 3;\n     end\nend\n    end');
            actual = matlabls.handlers.formatting.formatCode(testCase.CodeSnippet2, 3, 4, options);

            testCase.verifyEqual(actual, expected);
        end

        % Test that formatted lines are correctly aligned with the surrounding code.
        % Each indent should be prepresented by 1 tab of size 4.
        function testAlignIndent4WithTabs_partialDocument (testCase)
            options.insertSpaces = false;
            options.tabSize = 4;

            expected = sprintf('if true\nif true\n \t if true\n\t\t x = 3;\n\t end\nend\n    end');
            actual = matlabls.handlers.formatting.formatCode(testCase.CodeSnippet2, 3, 4, options);

            testCase.verifyEqual(actual, expected);
        end

        % Test that formatted lines are correctly aligned with the surrounding code.
        % Each indent should be prepresented by 6 spaces.
        function testAlignIndent6WithSpaces_partialDocument (testCase)
            options.insertSpaces = true;
            options.tabSize = 6;

            expected = sprintf('if true\nif true\n \t if true\n             x = 3;\n       end\nend\n    end');
            actual = matlabls.handlers.formatting.formatCode(testCase.CodeSnippet2, 3, 4, options);

            testCase.verifyEqual(actual, expected);
        end

        % Test that formatted lines are correctly aligned with the surrounding code.
        % Each indent should be prepresented by 1 tab of size 6.
        function testAlignIndent6WithTabs_partialDocument (testCase)
            options.insertSpaces = false;
            options.tabSize = 6;

            expected = sprintf('if true\nif true\n \t if true\n\t\t x = 3;\n\t end\nend\n    end');
            actual = matlabls.handlers.formatting.formatCode(testCase.CodeSnippet2, 3, 4, options);

            testCase.verifyEqual(actual, expected);
        end
    end
end
