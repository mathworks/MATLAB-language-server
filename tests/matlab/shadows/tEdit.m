% Copyright 2025 The MathWorks, Inc.
classdef tEdit < matlab.unittest.TestCase
    methods (TestClassSetup)
        function setup(~)
            % Add language server code to path
            addpath("../../../matlab/shadows/edit");
        end
    end

    methods (TestMethodTeardown)
        function teardown(~)
            if hasTemporaryValue(settings().matlab.editor.UseMATLABEditor)
                clearTemporaryValue(settings().matlab.editor.UseMATLABEditor);
            end
        end
    end

    methods (Test)
        function testUninitializedError(testCase)
            % Test that an error is thrown if the shadow function is uninitialized

            % Initilize with [] to force back into an uninitialized state
            edit('__SET__', {[]});

            % Verify an error is thrown
            testCase.verifyError(@() edit('someFile.m'), 'MATLAB:edit:UninitializedShadow');
        end

        function testInitialization(testCase)
            % Test that the shadow function can be initialized

            editSpy = @(varargin) disp('Edit called');

            % Initialize the shadow function
            edit('__SET__', {editSpy});

            % Verify no error occurs when calling edit after initialization
            try
                edit('someFile.m');
                testCase.verifyTrue(true); % No error thrown
            catch ME
                testCase.verifyFail(['Edit shadow threw an error: ' e.message]);
            end
        end

        function testNoArgsWithMatlabEditor(testCase)
            % Test that edit with no args works when set to use the MATLAB
            % Editor.

            s = settings;
            s.matlab.editor.UseMATLABEditor.TemporaryValue = true;
            
            % Create a spy for the original edit function
            baseEditCalled = false;
            function editSpy ()
                baseEditCalled = true;
            end
            edit('__SET__', {@editSpy});

            % Call edit with no args
            edit();

            % Verify that the base edit function was called
            testCase.verifyTrue(baseEditCalled);
        end

        function testNoArgsWithExternalEditor(testCase)
            % Test that an error is thrown when calling edit with no args
            % when set to use an external editor.

            s = settings;
            s.matlab.editor.UseMATLABEditor.TemporaryValue = false;

            % Create a spy for the original edit function
            baseEditCalled = false;
            function editSpy ()
                baseEditCalled = true;
            end
            edit('__SET__', {@editSpy});

            % Verify an error is thrown when calling edit with no args
            testCase.verifyError(@() edit(), 'MATLAB:edit:NoArgsNotAllowed');

            % Verify no MATLAB editors open
            testCase.verifyTrue(~baseEditCalled);
        end

        function testEditWithArgs (testCase)
            % Test that edit with args works regardless of editor setting

            s = settings;

            % Create a spy for the original edit function
            editArgs = {};
            function editSpy (varargin)
                editArgs = varargin; % Capture the arguments passed to the spy
            end
            edit('__SET__', {@editSpy});

            % Verify when using MATLAB Editor
            s.matlab.editor.UseMATLABEditor.TemporaryValue = true;
            edit('file1.m', 'file2.js');
            testCase.verifyEqual(editArgs, {'file1.m', 'file2.js'});

            % Verify when using external editor
            s.matlab.editor.UseMATLABEditor.TemporaryValue = false;
            edit('file3.java', 'file4.m');
            testCase.verifyEqual(editArgs, {'file3.java', 'file4.m'});
        end
    end
end
