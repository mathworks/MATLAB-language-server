function tests = functionBasedTest
    tests = functiontests(localfunctions);
end

function testSomething(testCase)
    testCase.verifyTrue(true);
end

function testAnotherThing(testCase)
    testCase.verifyEqual(2+2, 4);
end
