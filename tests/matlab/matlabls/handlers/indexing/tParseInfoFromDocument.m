% Copyright 2025 The MathWorks, Inc.
classdef tParseInfoFromDocument < matlab.unittest.TestCase
    methods (TestClassSetup)
        function setup (~)
            % Add function under test to path
            addpath("../../../../../matlab");

            % No need to add testData directory to path
        end
    end

    methods (Test)
        % Test parsing info from a script file
        function testParsingScriptFile (testCase)
            filePath = fullfile(pwd, 'testData', 'sampleScript.m');
            code = fileread(filePath);

            result = matlabls.handlers.indexing.parseInfoFromDocument(code, filePath, 0);

            testCase.assertEmpty(result.packageName);
            testCase.assertFalse(result.classInfo.hasClassInfo);
            testCase.assertEmpty(result.functionInfo);

            % Note: Function references appear first in the list
            expectedReferences = {
                {'disp', toRange(1, 1, 1, 5)},...
                {'linspace', toRange(4, 5, 4, 13)},...
                {'sin', toRange(5, 5, 5, 8)},...
                {'plot', toRange(8, 1, 8, 5)},...
                {'x', toRange(4, 1, 4, 2)},...
                {'y', toRange(5, 1, 5, 2)},...
                {'x', toRange(5, 9, 5, 10)},...
                {'x', toRange(8, 6, 8, 7)},...
                {'y', toRange(8, 9, 8, 10)}
            };
            testCase.assertEqual(result.references, expectedReferences);

            expectedSections = {
                struct(title = "Create Data", range = toRange(3, 1, 6, 2)),...
                struct(title = "Plot", range = toRange(7, 1, 8, 11))
            };

            testCase.assertEqual(result.sections, expectedSections);
        end

        % Test parsing info from a function file
        function testParsingFunctionFile (testCase)
            filePath = fullfile(pwd, 'testData', '+package', 'sampleFunction.m');
            code = fileread(filePath);

            result = matlabls.handlers.indexing.parseInfoFromDocument(code, filePath, 0);

            testCase.assertEqual(result.packageName, "package");
            testCase.assertFalse(result.classInfo.hasClassInfo);
            testCase.assertEqual(numel(result.functionInfo), 3);

            % ---------- Local Function ---------- %
            fcnInfo = result.functionInfo{1};
            testCase.assertEqual(fcnInfo.name, 'localFunction');
            testCase.assertEqual(fcnInfo.range, toRange(11, 1, 14, 4));
            testCase.assertEmpty(fcnInfo.parentClass);
            testCase.assertFalse(fcnInfo.isPublic);

            expectedVarDefs = {
                ... Input variables
                {'in1Local', toRange(12, 24, 12, 32)},...
                {'in2Local', toRange(12, 34, 12, 42)},...
                ... Output variables
                {'outLocal', toRange(11, 10, 11, 18)},...
                ... Definitions within function body
                {'outLocal', toRange(13, 5, 13, 13)}
            };
            testCase.assertEqual(fcnInfo.variableInfo.definitions, expectedVarDefs);

            expectedVarRefs = {
                ... In order of appearance
                {'outLocal', toRange(11, 10, 11, 18)},...
                {'in1Local', toRange(12, 24, 12, 32)},...
                {'in2Local', toRange(12, 34, 12, 42)},...
                {'outLocal', toRange(13, 5, 13, 13)},...
                {'in1Local', toRange(13, 20, 13, 28)},...
                {'in2Local', toRange(13, 30, 13, 38)},
            };
            testCase.assertEqual(fcnInfo.variableInfo.references, expectedVarRefs);

            testCase.assertEmpty(fcnInfo.globals);
            testCase.assertFalse(fcnInfo.isPrototype);
            testCase.assertEqual(fcnInfo.declaration, toRange(11, 1, 12, 43));

            % ---------- Nested Function ---------- %
            fcnInfo = result.functionInfo{2};

            testCase.assertEqual(fcnInfo.name, 'nestedFunction');
            testCase.assertEqual(fcnInfo.range, toRange(5, 5, 8, 8));
            testCase.assertEmpty(fcnInfo.parentClass);
            testCase.assertFalse(fcnInfo.isPublic);

            expectedVarDefs = {
                ... Global variables
                {'globalVar', toRange(6, 16, 6, 25)},...
                ... Input variables
                {'inNested', toRange(5, 42, 5, 50)},...
                ... Output variables
                {'outNested', toRange(5, 14, 5, 23)},...
                ... Definitions within function body
                {'outNested', toRange(7, 9, 7, 18)}
            };
            testCase.assertEqual(fcnInfo.variableInfo.definitions, expectedVarDefs);

            expectedVarRefs = {
                ... In order of appearance
                {'outNested', toRange(5, 14, 5, 23)},...
                {'inNested', toRange(5, 42, 5, 50)},...
                {'globalVar', toRange(6, 16, 6, 25)},...
                {'outNested', toRange(7, 9, 7, 18)},...
                {'inNested', toRange(7, 25, 7, 33)}
            };
            testCase.assertEqual(fcnInfo.variableInfo.references, expectedVarRefs);

            testCase.assertEqual(fcnInfo.globals, {'globalVar'});
            testCase.assertFalse(fcnInfo.isPrototype);
            testCase.assertEqual(fcnInfo.declaration, toRange(5, 5, 5, 51));

            % ---------- Main Function ---------- %
            fcnInfo = result.functionInfo{3};

            testCase.assertEqual(fcnInfo.name, 'sampleFunction');
            testCase.assertEqual(fcnInfo.range, toRange(1, 1, 9, 4));
            testCase.assertEmpty(fcnInfo.parentClass);
            testCase.assertTrue(fcnInfo.isPublic);

            expectedVarDefs = {
                ... Global variables
                {'globalVar', toRange(6, 16, 6, 25)},...
                ... Input variables
                {'in1', toRange(1, 41, 1, 44)},...
                {'in2', toRange(1, 46, 1, 49)},...
                {'in3', toRange(1, 51, 1, 54)},...
                ... Output variables
                {'out1', toRange(1, 11, 1, 15)},...
                {'out2', toRange(1, 17, 1, 21)},...
                ... Definitions within function body
                {'out1', toRange(2, 5, 2, 9)},...
                {'out2', toRange(3, 5, 3, 9)},...
                {'outNested', toRange(7, 9, 7, 18)}
            };
            testCase.assertEqual(fcnInfo.variableInfo.definitions, expectedVarDefs);

            expectedVarRefs = {
                ... In order of appearance
                {'out1', toRange(1, 11, 1, 15)},...
                {'out2', toRange(1, 17, 1, 21)},...
                {'in1', toRange(1, 41, 1, 44)},...
                {'in2', toRange(1, 46, 1, 49)},...
                {'in3', toRange(1, 51, 1, 54)},...
                {'out1', toRange(2, 5, 2, 9)},...
                {'in1', toRange(2, 26, 2, 29)},...
                {'in2', toRange(2, 31, 2, 34)},...
                {'out2', toRange(3, 5, 3, 9)},...
                {'in3', toRange(3, 27, 3, 30)},...
                {'outNested', toRange(5, 14, 5, 23)},...
                {'inNested', toRange(5, 42, 5, 50)},...
                {'globalVar', toRange(6, 16, 6, 25)},...
                {'outNested', toRange(7, 9, 7, 18)},...
                {'inNested', toRange(7, 25, 7, 33)}
            };
            testCase.assertEqual(fcnInfo.variableInfo.references, expectedVarRefs);

            testCase.assertEqual(fcnInfo.globals, {'globalVar'});
            testCase.assertFalse(fcnInfo.isPrototype);
            testCase.assertEqual(fcnInfo.declaration, toRange(1, 1, 1, 55));
        end

        % Test parsing info from a class file
        function testParsingClassFile (testCase)
            filePath = fullfile(pwd, 'testData', 'SampleClass.m');
            code = fileread(filePath);

            result = matlabls.handlers.indexing.parseInfoFromDocument(code, filePath, 0);

            testCase.assertEmpty(result.packageName);

            % ---------- Class Info ---------- %
            classInfo = result.classInfo;
            testCase.assertTrue(classInfo.isClassDef);
            testCase.assertTrue(classInfo.hasClassInfo);
            testCase.assertEqual(classInfo.name, 'SampleClass');
            testCase.assertEqual(classInfo.range, toRange(1, 1, 34, 4));
            testCase.assertEqual(classInfo.declaration, toRange(1, 1, 2, 24))

            expectedProperties = {
                struct(name = 'PropA', range = toRange(10, 9, 10, 14), parentClass = 'SampleClass', isPublic = false),...
                struct(name = 'PropB', range = toRange(11, 9, 11, 14), parentClass = 'SampleClass', isPublic = false)
            };
            testCase.assertEqual(classInfo.properties, expectedProperties);

            expectedEnumerations = {
                struct(name = 'A', range = toRange(4, 9, 4, 10), parentClass = 'SampleClass', isPublic = false),...
                struct(name = 'B', range = toRange(5, 9, 5, 10), parentClass = 'SampleClass', isPublic = false),...
                struct(name = 'C', range = toRange(6, 9, 6, 10), parentClass = 'SampleClass', isPublic = false)
            };
            testCase.assertEqual(classInfo.enumerations, expectedEnumerations);

            testCase.assertEmpty(classInfo.classDefFolder);
            testCase.assertEqual(classInfo.baseClasses, {'SuperA', 'SuperB'});

            testCase.assertEqual(numel(result.functionInfo), 4);

            % Note: Only checking certain attributes of functions, as the
            % majority of other cases should be covered by the above test.

            % ---------- Constructor ---------- %
            fcnInfo = result.functionInfo{1};
            testCase.assertEqual(fcnInfo.name, 'SampleClass');
            testCase.assertEqual(fcnInfo.parentClass, 'SampleClass');
            testCase.assertTrue(fcnInfo.isPublic);
            testCase.assertFalse(fcnInfo.isPrototype);

            % ---------- Abstract Function ---------- %
            fcnInfo = result.functionInfo{2};
            testCase.assertEqual(fcnInfo.name, 'abstractFcn');
            testCase.assertEqual(fcnInfo.parentClass, 'SampleClass');
            testCase.assertTrue(fcnInfo.isPublic);
            testCase.assertTrue(fcnInfo.isPrototype);


            % ---------- Private Function ---------- %
            fcnInfo = result.functionInfo{3};
            testCase.assertEqual(fcnInfo.name, 'privateFcn');
            testCase.assertEqual(fcnInfo.parentClass, 'SampleClass');
            testCase.assertTrue(fcnInfo.isPublic); % This is currently marked as public, despite being hidden
            testCase.assertFalse(fcnInfo.isPrototype);


            % ---------- Public Function ---------- %
            fcnInfo = result.functionInfo{4};
            testCase.assertEqual(fcnInfo.name, 'publicFcn');
            testCase.assertEqual(fcnInfo.parentClass, 'SampleClass');
            testCase.assertTrue(fcnInfo.isPublic);
            testCase.assertFalse(fcnInfo.isPrototype);

            % ---------- References ---------- %
            % Note: Property references appear first, then function references
            expectedReferences = {
                {'obj.PropA', toRange(16, 13, 16, 22)},...
                {'obj.PropB', toRange(17, 13, 17, 22)},...
                {'obj.PropA', toRange(30, 38, 30, 47)},...
                {'obj.PropB', toRange(31, 30, 31, 39)},...
                {'SampleClass', toRange(15, 24, 15, 35)},...
                {'publicFcn', toRange(20, 18, 20, 27)},...
                {'abstractFcn', toRange(25, 15, 25, 26)},...
                {'privateFcn', toRange(29, 18, 29, 28)},...
                {'disp', toRange(30, 13, 30, 17)},...
                {'num2str', toRange(30, 30, 30, 37)},...
                {'disp', toRange(31, 13, 31, 17)}
            };
            testCase.assertEqual(result.references, expectedReferences);
        end

        % Test parsing info from a @folder test
        function testParsingFolderClass (testCase)
            % Note: Only checking certain attributes of functions and
            % classes, as the majority of other cases should be covered
            % by the above tests.

            classFolder = fullfile(pwd, 'testData', '@FolderClass');

            % ---------- Classdef File ---------- %
            filePath = fullfile(classFolder, 'FolderClass.m');
            code = fileread(filePath);
            result = matlabls.handlers.indexing.parseInfoFromDocument(code, filePath, 0);

            testCase.assertEmpty(result.packageName);
            testCase.assertEqual(numel(result.functionInfo), 1);
            
            classInfo = result.classInfo;
            testCase.assertTrue(classInfo.isClassDef);
            testCase.assertTrue(classInfo.hasClassInfo);
            testCase.assertEqual(classInfo.name, 'FolderClass');
            testCase.assertEqual(classInfo.classDefFolder, classFolder);

            % ---------- Function File ---------- %
            filePath = fullfile(classFolder, 'folderFunction.m');
            code = fileread(filePath);
            result = matlabls.handlers.indexing.parseInfoFromDocument(code, filePath, 0);

            testCase.assertEmpty(result.packageName);
            testCase.assertEqual(numel(result.functionInfo), 1);
            
            classInfo = result.classInfo;
            testCase.assertFalse(classInfo.isClassDef);
            testCase.assertTrue(classInfo.hasClassInfo);
            testCase.assertEqual(classInfo.name, 'FolderClass');
            testCase.assertEqual(classInfo.classDefFolder, classFolder);
        end

        % Test parsing info with different analysis limits
        function testFileAnalysisLimit (testCase)
            code = "function foo (), end";
            filePath = "some/path/foo.m";

            % Case 1: Ensure data is returned with unlimited analysis limit
            result = matlabls.handlers.indexing.parseInfoFromDocument(code, filePath, 0);
            testCase.assertNotEmpty(result.functionInfo);

            % Case 2: Ensure no data is returned with small limit
            result = matlabls.handlers.indexing.parseInfoFromDocument(code, filePath, 10);
            testCase.assertEmpty(result.functionInfo);

            % Case 3: Ensure data is returned with large limit
            result = matlabls.handlers.indexing.parseInfoFromDocument(code, filePath, 100);
            testCase.assertNotEmpty(result.functionInfo);
        end
    end
end

% Helper functions:
function range = toRange(lineStart, charStart, lineEnd, charEnd)
    range = struct(lineStart = lineStart, charStart = charStart, lineEnd = lineEnd, charEnd = charEnd);
end
