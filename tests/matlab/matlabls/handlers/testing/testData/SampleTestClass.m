classdef SampleTestClass < matlab.unittest.TestCase
    methods (Test)
        function testAddition(testCase)
            testCase.verifyEqual(1+1, 2);
        end

        function testSubtraction(testCase)
            testCase.verifyEqual(3-1, 2);
        end
    end
end
