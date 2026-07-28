classdef ParameterizedTestClass < matlab.unittest.TestCase
    properties (TestParameter)
        value = {1, 2, 3}
    end

    methods (Test)
        function testWithParam(testCase, value)
            testCase.verifyGreaterThan(value, 0);
        end
    end
end
