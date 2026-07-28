% Copyright 2026 The MathWorks, Inc.
classdef tTextOutputStream < matlab.unittest.TestCase

    methods (TestClassSetup)
        function addPaths(~)
            addpath("../../../../../matlab");
        end
    end

    methods (Test)
        function testConstructorCreatesStream(testCase)
            stream = TextOutputStreamSpy('/test/channel');
            testCase.verifyClass(stream, 'TextOutputStreamSpy');
        end

        function testPrintPublishesOutputEvent(testCase)
            stream = TextOutputStreamSpy('/test/output');

            stream.print('Hello World');

            testCase.verifyEqual(numel(stream.CapturedEvents), 1);
            testCase.verifyEqual(stream.CapturedEvents{1}.type, 'output');
            testCase.verifyEqual(stream.CapturedEvents{1}.text, 'Hello World');
        end

        function testPrintFormatsWithSprintf(testCase)
            stream = TextOutputStreamSpy('/test/format');

            stream.print('Value: %d, Name: %s', 42, 'test');

            testCase.verifyEqual(stream.CapturedEvents{1}.text, 'Value: 42, Name: test');
        end

        function testPrintHandlesFloatingPoint(testCase)
            stream = TextOutputStreamSpy('/test/float');

            stream.print('Pi is %.2f', pi);

            testCase.verifyEqual(stream.CapturedEvents{1}.text, 'Pi is 3.14');
        end

        function testMultiplePrintCallsPublishMultipleEvents(testCase)
            stream = TextOutputStreamSpy('/test/multi');

            stream.print('First');
            stream.print('Second');
            stream.print('Third');

            testCase.verifyEqual(numel(stream.CapturedEvents), 3);
            testCase.verifyEqual(stream.CapturedEvents{1}.text, 'First');
            testCase.verifyEqual(stream.CapturedEvents{2}.text, 'Second');
            testCase.verifyEqual(stream.CapturedEvents{3}.text, 'Third');
        end

        function testEventTypeIsAlwaysOutput(testCase)
            stream = TextOutputStreamSpy('/test/type');

            stream.print('anything');

            testCase.verifyEqual(stream.CapturedEvents{1}.type, 'output');
        end

        function testPrintWithNewlineCharacter(testCase)
            stream = TextOutputStreamSpy('/test/newline');

            stream.print('Line1\nLine2');

            expected = sprintf('Line1\nLine2');
            testCase.verifyEqual(stream.CapturedEvents{1}.text, expected);
        end
    end
end
