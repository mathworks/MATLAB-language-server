% Copyright 2025 The MathWorks, Inc.
classdef tResolveNameToPath < matlab.unittest.TestCase
    methods (TestClassSetup)
        function setup (~)
            % Add function under test to path
            addpath("../../../../../matlab");

            % Note: The testData directory is not added to the path in setup
            % in order to test cases when it IS and IS NOT on the path.
        end
    end

    methods (Test)
        % Test a file which ships with MATLAB
        function testResolveNameToShippingFunction (testCase)
            name = "parula";
            contextFile = strcat(mfilename("fullpath"), ".m");

            result = matlabls.handlers.navigation.resolveNameToPath(name, contextFile);
            testCase.assertTrue(startsWith(result, matlabroot));
            testCase.assertSubstring(result, name);
        end

        % Test a built-in which ships with MATLAB
        function testResolveNameWithBuiltIn (testCase)
            name = "disp";
            contextFile = strcat(mfilename("fullpath"), ".m");

            result = matlabls.handlers.navigation.resolveNameToPath(name, contextFile);

            if isMATLABReleaseOlderThan("R2025a")
                testCase.assertTrue(startsWith(result, matlabroot));
                testCase.assertSubstring(result, name);
            else
                % Help text .m files are no longer shipped with MATLAB in 25a.
                % In this case, resolveNameToPath should return an empty char vector.
                testCase.assertEmpty(result);
            end
        end

        % Test a user-defined function which is located on the path
        function testResolveNameToUserFunctionOnPath (testCase)
            name = "myHelperFunction";
            contextFile = strcat(mfilename("fullpath"), ".m");

            % Case 1: Function should not be found prior to adding to path
            result = matlabls.handlers.navigation.resolveNameToPath(name, contextFile);
            testCase.assertEmpty(result);

            % Case 2: Function should be found after adding to path
            pathToAdd = fullfile(pwd, "testData");
            addpath(pathToAdd);

            result = matlabls.handlers.navigation.resolveNameToPath(name, contextFile);
            expected = fullfile(pwd, "testData", "myHelperFunction.m");
            testCase.assertTrue(strcmp(result, expected));

            % Cleanup
            rmpath(pathToAdd);
        end

        % Test a user-defined function which is in the same directory as the context file
        function testResolveNameToUserFunctionNotOnPath (testCase)
            name = "myHelperFunction";

            % Case 1: Function should not be found when context file is not in the same folder
            contextFile = strcat(mfilename("fullpath"), ".m");

            result = matlabls.handlers.navigation.resolveNameToPath(name, contextFile);
            testCase.assertEmpty(result);

            % Case 2: Function should be found when context file is in the same folder
            contextFile = fullfile(pwd, "testData", "testScript.m");

            result = matlabls.handlers.navigation.resolveNameToPath(name, contextFile);            
            expected = fullfile(pwd, "testData", "myHelperFunction.m");
            testCase.assertTrue(strcmp(result, expected));
        end

        % Test that a nonexistent function is not found
        function testResolveNameToNonexistentFunction (testCase)
            name = "__nonexistent_function123_";
            contextFile = strcat(mfilename("fullpath"), ".m");

            result = matlabls.handlers.navigation.resolveNameToPath(name, contextFile);
            testCase.assertEmpty(result);
        end
    end
end
