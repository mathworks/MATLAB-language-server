classdef SomeNsTest < matlab.unittest.TestCase
    methods (Test)
        function testInNamespace(testCase)
            testCase.verifyEqual(1+1, 2);
        end
    end
end
