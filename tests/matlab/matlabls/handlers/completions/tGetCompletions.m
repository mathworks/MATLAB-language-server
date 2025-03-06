% Copyright 2025 The MathWorks, Inc.
classdef tGetCompletions < matlab.unittest.TestCase
    methods (TestClassSetup)
        function setup (~)
            % Add function under test to path
            addpath("../../../../../matlab");

            % Add test file to path
            addpath("./testData");
        end
    end

    methods (Test)
        % Test a basic case of function completion
        function testFunctionCompletion (testCase)
            code = 'myHelpfulTestFunc';
            fileName = 'myFileName.m';
            cursorPosition = 17;

            result = matlabls.handlers.completions.getCompletions(code, fileName, cursorPosition);

            testCase.verifyEqual(result.widgetType, 'completion');
            testCase.verifyEqual(result.widgetData.choices.matchType, 'mFile');
            testCase.verifyEqual(result.widgetData.choices.completion, 'myHelpfulTestFunction')
        end

        % Test multiple function signatures
        function testMultipleFunctionSignatures (testCase)
            code = 'myHelpfulTestFunction(';
            fileName = 'myFileName.m';
            cursorPosition = 22;

            result = matlabls.handlers.completions.getCompletions(code, fileName, cursorPosition);

            testCase.verifyTrue(isfield(result, 'signatures'));
            testCase.verifyEqual(numel(result.signatures), 2);

            % Check signature 1
            sig1 = result.signatures(1);

            testCase.verifyEqual(numel(sig1.inputArguments), 2);

            testCase.verifyEqual(sig1.inputArguments{1}.name, 'in1');
            testCase.verifyEqual(sig1.inputArguments{1}.purpose, 'The first numeric value');

            testCase.verifyEqual(sig1.inputArguments{2}.name, 'in2');
            testCase.verifyEqual(sig1.inputArguments{2}.purpose, 'The second numeric value');

            testCase.verifyEqual(numel(sig1.outputArguments), 1);

            testCase.verifyEqual(sig1.outputArguments.name, 'out');
            testCase.verifyEqual(sig1.outputArguments.purpose, 'The sum of the inputs');

            % Check signature 2
            sig2 = result.signatures(2);

            testCase.verifyEqual(numel(sig2.inputArguments), 3);

            testCase.verifyEqual(sig2.inputArguments{1}.name, 'in1');
            testCase.verifyEqual(sig2.inputArguments{1}.purpose, 'The first string value');

            testCase.verifyEqual(sig2.inputArguments{2}.name, 'in2');
            testCase.verifyEqual(sig2.inputArguments{2}.purpose, 'The second string value');

            testCase.verifyEqual(sig2.inputArguments{3}.name, 'in3');
            testCase.verifyEqual(sig2.inputArguments{3}.purpose, 'The third string value');

            testCase.verifyEqual(numel(sig2.outputArguments), 1);

            testCase.verifyEqual(sig2.outputArguments.name, 'out');
            testCase.verifyEqual(sig2.outputArguments.purpose, 'The concatenation of the inputs');
        end
    end
end
