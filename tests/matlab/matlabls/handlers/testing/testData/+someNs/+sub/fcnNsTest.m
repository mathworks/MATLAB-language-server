function tests = fcnNsTest
    tests = functiontests(localfunctions);
end

function testInNamespace(testCase)
    testCase.verifyTrue(true);
end
