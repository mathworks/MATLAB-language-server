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
        function testParsingScriptFile (testCase)
            import matlab.unittest.constraints.HasField
            
            filePath = fullfile(pwd, 'testData', 'sampleScript.m');
            code = fileread(filePath);

            result = matlabls.handlers.indexing.parseInfoFromDocument(code, filePath, 0);

            testCase.assertEmpty(result.package);
            testCase.assertEmpty(result.classReferences);
            testCase.assertFalse(result.hasClassInfo);
            testCase.assertThat(result, ~HasField("classDefFolder"));
            testCase.assertThat(result, ~HasField("errorInfo"));

            expectedFunctionOrUnboundReferences = {
                ... In order of appearance
                createSingleComponentIdentifier('disp', [1, 1, 1, 5]),...
                createSingleComponentIdentifier('linspace', [4, 5, 4, 13]),...
                createSingleComponentIdentifier('sin', [5, 5, 5, 8], 'x'),...
                createSingleComponentIdentifier('plot', [8, 1, 8, 5], 'x')
            };
            testCase.assertEqual(...
                result.globalScope.functionOrUnboundReferences,...
                expectedFunctionOrUnboundReferences...
            );

            expectedVariableReferences = {
                ... In order of appearance
                createSingleComponentIdentifier('x', [4, 1, 4, 2]),...
                createSingleComponentIdentifier('y', [5, 1, 5, 2]),...
                createSingleComponentIdentifier('x', [5, 9, 5, 10]),...
                createSingleComponentIdentifier('x', [8, 6, 8, 7]),...
                createSingleComponentIdentifier('y', [8, 9, 8, 10]),...
                createSingleComponentIdentifier('a', [11, 8, 11, 9]),...
                createSingleComponentIdentifier('i', [13, 5, 13, 6]),...
                createSingleComponentIdentifier('b', [14, 12, 14, 13]),...
                createSingleComponentIdentifier('j', [16, 12, 16, 13])
            };
            testCase.assertEqual(...
                result.globalScope.variableReferences,...
                expectedVariableReferences...
            );

            expectedVariableDefinitions = {
                ... Global variables
                createSingleComponentIdentifier('a', [11, 8, 11, 9]),...
                createSingleComponentIdentifier('b', [14, 12, 14, 13]),...
                ... Variable assignments
                createSingleComponentIdentifier('x', [4, 1, 4, 2]),...
                createSingleComponentIdentifier('y', [5, 1, 5, 2]),...
                ... For and parfor loop index variables
                createSingleComponentIdentifier('i', [13, 5, 13, 6]),...
                createSingleComponentIdentifier('j', [16, 12, 16, 13])
            };
            testCase.assertEqual(...
                result.globalScope.variableDefinitions,...
                expectedVariableDefinitions...
            );

            testCase.assertEqual(result.globalScope.globals, {'a', 'b'});
            testCase.assertThat(result.globalScope, ~HasField("classScope"));
            testCase.assertEmpty(result.globalScope.functionScopes);

            expectedSections = {
                createSection("Section 1", [1, 1, 2, 1], false),...
                createSection("Create Data", [3, 1, 6, 1], true),...
                createSection("Plot", [7, 1, 9, 1], true),...
                createSection("Additional Variable Definitions", [10, 1, 18, 4], true)
            };
            testCase.assertEqual(result.sections, expectedSections);
        end

        function testParsingFunctionFile (testCase)
            import matlab.unittest.constraints.HasField

            filePath = fullfile(pwd, 'testData', '+package', 'sampleFunction.m');
            code = fileread(filePath);

            result = matlabls.handlers.indexing.parseInfoFromDocument(code, filePath, 0);

            testCase.assertEqual(result.package, "package");
            testCase.assertEmpty(result.classReferences);
            testCase.assertFalse(result.hasClassInfo);
            testCase.assertThat(result, ~HasField("classDefFolder"));
            testCase.assertThat(result, ~HasField("errorInfo"));

            testCase.assertEqual(numel(result.globalScope.functionScopes), 2);
            testCase.assertEqual(numel(result.globalScope.functionScopes{1}.nestedScopes), 1);

            % ---------- Main Function ---------- %
            fcnInfo = result.globalScope.functionScopes{1};

            testCase.assertEqual(fcnInfo.declarationNameId.name, 'sampleFunction');
            testCase.assertEqual(fcnInfo.declarationNameId.range, convertRange([1, 25, 1, 39]));
            testCase.assertEqual(fcnInfo.range, convertRange([1, 1, 9, 4]));
            testCase.assertTrue(fcnInfo.isPublic);

            expectedVarDefs = {
                ... Input variables
                createSingleComponentIdentifier('in1', [1, 41, 1, 44]),...
                createSingleComponentIdentifier('in2', [1, 46, 1, 49]),...
                createSingleComponentIdentifier('in3', [1, 51, 1, 54]),...
                ... Output variables
                createSingleComponentIdentifier('out1', [1, 11, 1, 15]),...
                createSingleComponentIdentifier('out2', [1, 17, 1, 21]),...
                ... Assignments within function body
                createSingleComponentIdentifier('out1', [2, 5, 2, 9]),...
                createSingleComponentIdentifier('out2', [3, 5, 3, 9])
            };
            testCase.assertEqual(fcnInfo.variableDefinitions, expectedVarDefs);

            expectedVarRefs = {
                ... In order of appearance
                createSingleComponentIdentifier('out1', [1, 11, 1, 15]),...
                createSingleComponentIdentifier('out2', [1, 17, 1, 21]),...
                createSingleComponentIdentifier('in1', [1, 41, 1, 44]),...
                createSingleComponentIdentifier('in2', [1, 46, 1, 49]),...
                createSingleComponentIdentifier('in3', [1, 51, 1, 54]),...
                createSingleComponentIdentifier('out1', [2, 5, 2, 9]),...
                createSingleComponentIdentifier('in1', [2, 26, 2, 29]),...
                createSingleComponentIdentifier('in2', [2, 31, 2, 34]),...
                createSingleComponentIdentifier('out2', [3, 5, 3, 9]),...
                createSingleComponentIdentifier('in3', [3, 27, 3, 30])
            };
            testCase.assertEqual(fcnInfo.variableReferences, expectedVarRefs);

            expectedFunctionOrUnboundRefs = {
                ... In order of appearance
                createSingleComponentIdentifier('localFunction', [2, 12, 2, 25], 'in1'),...
                createSingleComponentIdentifier('nestedFunction', [3, 12, 3, 26], 'in3')
            };
            testCase.assertEqual(fcnInfo.functionOrUnboundReferences, expectedFunctionOrUnboundRefs);

            testCase.assertFalse(fcnInfo.isPrototype);
            testCase.assertEmpty(fcnInfo.globals);
            testCase.assertFalse(fcnInfo.isConstructor);
            testCase.assertFalse(fcnInfo.isStaticMethod);
            testCase.assertEqual(fcnInfo.inputArgs, {'in1', 'in2', 'in3'});
            testCase.assertEqual(fcnInfo.outputArgs, {'out1', 'out2'});

            % ---------- Nested Function ---------- %
            fcnInfo = result.globalScope.functionScopes{1}.nestedScopes{1};

            testCase.assertEqual(fcnInfo.declarationNameId.name, 'nestedFunction');
            testCase.assertEqual(fcnInfo.declarationNameId.range, convertRange([5, 26, 5, 40]));
            testCase.assertEqual(fcnInfo.range, convertRange([5, 5, 8, 8]));
            testCase.assertFalse(fcnInfo.isPublic);

            expectedVarDefs = {
                ... Global variables
                createSingleComponentIdentifier('globalVar', [6, 16, 6, 25]),...
                ... Input variables
                createSingleComponentIdentifier('inNested', [5, 42, 5, 50]),...
                ... Output variables
                createSingleComponentIdentifier('outNested', [5, 14, 5, 23]),...
                ... Assignments within function body
                createSingleComponentIdentifier('outNested', [7, 9, 7, 18])
            };
            testCase.assertEqual(fcnInfo.variableDefinitions, expectedVarDefs);

            expectedVarRefs = {
                ... In order of appearance
                createSingleComponentIdentifier('outNested', [5, 14, 5, 23]),...
                createSingleComponentIdentifier('inNested', [5, 42, 5, 50]),...
                createSingleComponentIdentifier('globalVar', [6, 16, 6, 25]),...
                createSingleComponentIdentifier('outNested', [7, 9, 7, 18]),...
                createSingleComponentIdentifier('inNested', [7, 25, 7, 33])
            };
            testCase.assertEqual(fcnInfo.variableReferences, expectedVarRefs);

            expectedFunctionOrUnboundRefs = {
                createSingleComponentIdentifier('abs', [7, 21, 7, 24], 'inNested')
            };
            testCase.assertEqual(fcnInfo.functionOrUnboundReferences, expectedFunctionOrUnboundRefs);

            testCase.assertFalse(fcnInfo.isPrototype);
            testCase.assertEqual(fcnInfo.globals, {'globalVar'});
            testCase.assertFalse(fcnInfo.isConstructor);
            testCase.assertFalse(fcnInfo.isStaticMethod);
            testCase.assertEqual(fcnInfo.inputArgs, {'inNested'});
            testCase.assertEqual(fcnInfo.outputArgs, {'outNested'});

            % ---------- Local Function ---------- %
            fcnInfo = result.globalScope.functionScopes{2};

            testCase.assertEqual(fcnInfo.declarationNameId.name, 'localFunction');
            testCase.assertEqual(fcnInfo.declarationNameId.range, convertRange([12, 9, 12, 22]));
            testCase.assertEqual(fcnInfo.range, convertRange([11, 1, 14, 4]));
            testCase.assertFalse(fcnInfo.isPublic);

            expectedVarDefs = {
                ... Input variables
                createSingleComponentIdentifier('in1Local', [12, 24, 12, 32]),...
                createSingleComponentIdentifier('in2Local', [12, 34, 12, 42]),...
                ... Output variables
                createSingleComponentIdentifier('outLocal', [11, 10, 11, 18]),...
                ... Assignments within function body
                createSingleComponentIdentifier('outLocal', [13, 5, 13, 13]),...
            };
            testCase.assertEqual(fcnInfo.variableDefinitions, expectedVarDefs);

            expectedVarRefs = {
                ... In order of appearance
                createSingleComponentIdentifier('outLocal', [11, 10, 11, 18]),...
                createSingleComponentIdentifier('in1Local', [12, 24, 12, 32]),...
                createSingleComponentIdentifier('in2Local', [12, 34, 12, 42]),...
                createSingleComponentIdentifier('outLocal', [13, 5, 13, 13]),...
                createSingleComponentIdentifier('in1Local', [13, 20, 13, 28]),...
                createSingleComponentIdentifier('in2Local', [13, 30, 13, 38])
            };
            testCase.assertEqual(fcnInfo.variableReferences, expectedVarRefs);

            expectedFunctionOrUnboundRefs = {
                createSingleComponentIdentifier('sum', [13, 16, 13, 19], 'in1Local')
            };
            testCase.assertEqual(fcnInfo.functionOrUnboundReferences, expectedFunctionOrUnboundRefs);

            testCase.assertFalse(fcnInfo.isPrototype);
            testCase.assertEmpty(fcnInfo.globals);
            testCase.assertFalse(fcnInfo.isConstructor);
            testCase.assertFalse(fcnInfo.isStaticMethod);
            testCase.assertEqual(fcnInfo.inputArgs, {'in1Local', 'in2Local'});
            testCase.assertEqual(fcnInfo.outputArgs, {'outLocal'});
        end

        function testParsingClassFile (testCase)
            import matlab.unittest.constraints.HasField
            
            filePath = fullfile(pwd, 'testData', 'SampleClass.m');
            code = fileread(filePath);

            result = matlabls.handlers.indexing.parseInfoFromDocument(code, filePath, 0);

            testCase.assertEmpty(result.package);
            testCase.assertTrue(result.hasClassInfo);
            testCase.assertThat(result, ~HasField("classDefFolder"));
            testCase.assertThat(result, ~HasField("errorInfo"));
            
            expectedClassRefs = {
                ... In order of appearance
                createNamedRange('SampleClass', [1, 10, 1, 21]),...
                createNamedRange('SuperA', [2, 9, 2, 15]),...
                createNamedRange('SuperB', [2, 18, 2, 24]),...
                createNamedRange('SampleClass', [33, 13, 33, 24]),...
                createNamedRange('SuperB', [34, 13, 34, 19]),...
                createNamedRange('SampleClass', [45, 10, 45, 21]),...
                createNamedRange('SampleClass', [46, 5, 46, 16])
            };
            testCase.assertEqual(result.classReferences, expectedClassRefs);

            % ---------- Class Info ---------- %
            classInfo = result.globalScope.classScope;
            testCase.assertEqual(classInfo.declarationNameId.name, 'SampleClass');
            testCase.assertEqual(classInfo.declarationNameId.range, convertRange([1, 10, 1, 21]));
            testCase.assertEqual(classInfo.range, convertRange([1, 1, 42, 4]));

            expectedBaseClasses = {
                createNamedRange('SuperA', [2, 9, 2, 15]),...
                createNamedRange('SuperB', [2, 18, 2, 24])
            };
            testCase.assertEqual(classInfo.baseClasses, expectedBaseClasses);

            expectedPropertiesBlocks = {
                createNamedRange('properties', [9, 5, 12, 8])
            };
            testCase.assertEqual(classInfo.propertiesBlocks, expectedPropertiesBlocks);

            expectedEnumerationsBlocks = {
                createNamedRange('enumeration', [3, 5, 7, 8])
            };
            testCase.assertEqual(classInfo.enumerationsBlocks, expectedEnumerationsBlocks);

            expectedMethodsBlocks = {
                createNamedRange('methods', [14, 5, 22, 8]),...
                createNamedRange('methods (Abstract)', [24, 5, 26, 8]),...
                createNamedRange('methods (Access=private)', [28, 5, 36, 8]),...
                createNamedRange('methods (Static)', [38, 5, 41, 8])
            };
            testCase.assertEqual(classInfo.methodsBlocks, expectedMethodsBlocks);

            expectedProperties = {
                createScopedNamedRange('PropA', [10, 9, 10, 14], true),...
                createScopedNamedRange('PropB', [11, 9, 11, 14], true)
            };
            testCase.assertEqual(classInfo.properties, expectedProperties);

            expectedEnumerations = {
                createScopedNamedRange('A', [4, 9, 4, 10], true),...
                createScopedNamedRange('B', [5, 9, 5, 10], true),...
                createScopedNamedRange('C', [6, 9, 6, 10], true)
            };
            testCase.assertEqual(classInfo.enumerations, expectedEnumerations);

            testCase.assertEqual(numel(classInfo.nestedScopes), 5);

            % Note: Only checking certain attributes of methods, as the
            % majority of other cases should be covered by other tests.

            % ---------- Constructor ---------- %
            fcnInfo = classInfo.nestedScopes{1};
            testCase.assertEqual(fcnInfo.declarationNameId.name, 'SampleClass');
            testCase.assertTrue(fcnInfo.isPublic);
            testCase.assertFalse(fcnInfo.isPrototype);
            testCase.assertTrue(fcnInfo.isConstructor);
            testCase.assertFalse(fcnInfo.isStaticMethod);

            expectedVarDefs = {
                ... Input variables
                createSingleComponentIdentifier('a', [15, 37, 15, 38]),...
                createSingleComponentIdentifier('b', [15, 40, 15, 41]),...
                ... Output variables
                createSingleComponentIdentifier('obj', [15, 18, 15, 21]),...
                ... Assignments within function body
                createIdentifier(...
                    'obj.PropA',...
                    [16, 13, 16, 22],...
                    {{'obj', [16, 13, 16, 16]}, {'PropA', [16, 17, 16, 22]}}...
                ),...
                createIdentifier(...
                    'obj.PropB',...
                    [17, 13, 17, 22],...
                    {{'obj', [17, 13, 17, 16]}, {'PropB', [17, 17, 17, 22]}}...
                )
            };
            testCase.assertEqual(fcnInfo.variableDefinitions, expectedVarDefs);

            expectedVarRefs = {
                ... In order of appearance
                createSingleComponentIdentifier('obj', [15, 18, 15, 21]),...
                createSingleComponentIdentifier('a', [15, 37, 15, 38]),...
                createSingleComponentIdentifier('b', [15, 40, 15, 41]),...
                createIdentifier(...
                    'obj.PropA',...
                    [16, 13, 16, 22],...
                    {{'obj', [16, 13, 16, 16]}, {'PropA', [16, 17, 16, 22]}}...
                ),...
                createSingleComponentIdentifier('a', [16, 25, 16, 26]),...
                createIdentifier(...
                    'obj.PropB',...
                    [17, 13, 17, 22],...
                    {{'obj', [17, 13, 17, 16]}, {'PropB', [17, 17, 17, 22]}}...
                ),...
                createSingleComponentIdentifier('b', [17, 25, 17, 26])
            };
            testCase.assertEqual(fcnInfo.variableReferences, expectedVarRefs);

            % ---------- Public Method ---------- %
            fcnInfo = classInfo.nestedScopes{2};
            testCase.assertEqual(fcnInfo.declarationNameId.name, 'publicFcn');
            testCase.assertTrue(fcnInfo.isPublic);
            testCase.assertFalse(fcnInfo.isPrototype);
            testCase.assertFalse(fcnInfo.isConstructor);
            testCase.assertFalse(fcnInfo.isStaticMethod);

            % ---------- Abstract Method ---------- %
            fcnInfo = classInfo.nestedScopes{3};
            testCase.assertEqual(fcnInfo.declarationNameId.name, 'abstractFcn');
            testCase.assertTrue(fcnInfo.isPublic);
            testCase.assertTrue(fcnInfo.isPrototype);
            testCase.assertFalse(fcnInfo.isConstructor);
            testCase.assertFalse(fcnInfo.isStaticMethod);

            % ---------- Private Method ---------- %
            fcnInfo = classInfo.nestedScopes{4};
            testCase.assertEqual(fcnInfo.declarationNameId.name, 'privateFcn');
            testCase.assertFalse(fcnInfo.isPublic);
            testCase.assertFalse(fcnInfo.isPrototype);
            testCase.assertFalse(fcnInfo.isConstructor);
            testCase.assertFalse(fcnInfo.isStaticMethod);

            % ---------- Static Method ---------- %
            fcnInfo = classInfo.nestedScopes{5};
            testCase.assertEqual(fcnInfo.declarationNameId.name, 'staticFcn');
            testCase.assertTrue(fcnInfo.isPublic);
            testCase.assertFalse(fcnInfo.isPrototype);
            testCase.assertFalse(fcnInfo.isConstructor);
            testCase.assertTrue(fcnInfo.isStaticMethod);

            % ---------- Local Function ---------- %
            fcnInfo = result.globalScope.functionScopes{1};
            testCase.assertEqual(fcnInfo.declarationNameId.name, 'local');
            testCase.assertFalse(fcnInfo.isPublic);
            testCase.assertFalse(fcnInfo.isPrototype);
            testCase.assertFalse(fcnInfo.isConstructor);
            testCase.assertFalse(fcnInfo.isStaticMethod);
        end

        % Test parsing info from an @folder
        function testParsingFolderClass (testCase)
            % Note: Only checking certain attributes of functions and
            % classes, as the majority of other cases should be covered
            % by other tests.

            import matlab.unittest.constraints.HasField

            classFolder = fullfile(pwd, 'testData', '@FolderClass');

            % ---------- Classdef File ---------- %
            filePath = fullfile(classFolder, 'FolderClass.m');
            code = fileread(filePath);
            result = matlabls.handlers.indexing.parseInfoFromDocument(code, filePath, 0);

            testCase.assertEmpty(result.package);
            testCase.assertTrue(result.hasClassInfo);
            testCase.assertEqual(result.classDefFolder, classFolder);
            testCase.assertThat(result, ~HasField("errorInfo"));
            
            expectedClassRefs = {
                createNamedRange('FolderClass', [1, 10, 1, 21]),...
                createNamedRange('handle', [1, 24, 1, 30])
            };
            testCase.assertEqual(result.classReferences, expectedClassRefs);

            testCase.assertEmpty(result.globalScope.functionScopes);

            classInfo = result.globalScope.classScope;
            testCase.assertEqual(classInfo.declarationNameId.name, 'FolderClass');
            testCase.assertEqual(classInfo.declarationNameId.range, convertRange([1, 10, 1, 21]));
            testCase.assertEqual(classInfo.range, convertRange([1, 1, 13, 4]));

            % ---------- Function File ---------- %
            filePath = fullfile(classFolder, 'folderFunction.m');
            code = fileread(filePath);
            result = matlabls.handlers.indexing.parseInfoFromDocument(code, filePath, 0);

            testCase.assertEmpty(result.package);
            testCase.assertTrue(result.hasClassInfo);
            testCase.assertEqual(result.classDefFolder, classFolder);
            testCase.assertThat(result, ~HasField("errorInfo"));
            
            testCase.assertEmpty(result.classReferences);
            testCase.assertEqual(numel(result.globalScope.functionScopes), 1);
            testCase.assertThat(result.globalScope, ~HasField("classScope"));
        end

        % Test parsing info with different analysis limits
        function testFileAnalysisLimit (testCase)
            code = "function foo (), end";
            filePath = "some/path/foo.m";

            % Case 1: Ensure data is returned with unlimited analysis limit
            result = matlabls.handlers.indexing.parseInfoFromDocument(code, filePath, 0);
            testCase.assertNotEmpty(result.globalScope.functionScopes);

            % Case 2: Ensure no data is returned with small limit
            result = matlabls.handlers.indexing.parseInfoFromDocument(code, filePath, 10);
            testCase.assertEmpty(result.globalScope.functionScopes);

            % Case 3: Ensure data is returned with large limit
            result = matlabls.handlers.indexing.parseInfoFromDocument(code, filePath, 100);
            testCase.assertNotEmpty(result.globalScope.functionScopes);
        end

        function testParsingEmptyFile (testCase)
            import matlab.unittest.constraints.HasField

            code = "";
            filePath = "some/path/foo.m";

            result = matlabls.handlers.indexing.parseInfoFromDocument(code, filePath, 0);

            % Important that parsing an empty file does not
            % return an error, so that we know to still
            % overwrite the file's code data in the Indexer
            testCase.assertThat(result, ~HasField("errorInfo"));

            testCase.assertNotEmpty(result.sections);

            testCase.assertEmpty(result.package);
            testCase.assertEmpty(result.classReferences);
            testCase.assertFalse(result.hasClassInfo);
            testCase.assertThat(result, ~HasField("classDefFolder"));

            testCase.assertEmpty(result.globalScope.variableDefinitions);
            testCase.assertEmpty(result.globalScope.variableReferences);
            testCase.assertEmpty(result.globalScope.functionOrUnboundReferences);
            testCase.assertEmpty(result.globalScope.globals);
            testCase.assertEmpty(result.globalScope.functionScopes);
            testCase.assertThat(result.globalScope, ~HasField("classScope"));
        end

        function testParsingSyntaxErrorFile (testCase)
            code = "end";
            filePath = "some/path/foo.m";

            result = matlabls.handlers.indexing.parseInfoFromDocument(code, filePath, 0);
            
            % Ensures we will not overwrite the file's code data
            % in the Indexer
            testCase.assertNotEmpty(result.errorInfo);
        end
    end
end

% Helper functions:

function identifierStruct = createSingleComponentIdentifier(name, oneBasedRange, firstArgIdName)
    identifierStruct = struct(...
        name = name,...
        range = convertRange(oneBasedRange),...
        ... identifierStruct.components is a single-layer cell array;
        ... the extra braces make sure it is still a cell array after
        ... vectorization
        components = {{ createNamedRange(name, oneBasedRange) }}...
    );

    if nargin >= 3
        identifierStruct.firstArgIdName = firstArgIdName;
    end
end

function identifierStruct = createIdentifier(name, range, components, firstArgIdName)
    numComponents = numel(components);

    componentStructs = cell(1, numComponents);
    for i = 1:numComponents
        componentStructs{i} = createNamedRange(components{i}{1}, components{i}{2});
    end

    identifierStruct = struct(...
        name = name,...
        range = convertRange(range),...
        ... identifierStruct.components is a single-layer cell array;
        ... the extra braces make sure it is still a cell array after
        ... vectorization
        components = {componentStructs}...
    );

    if nargin >= 4
        identifierStruct.firstArgIdName = firstArgIdName;
    end
end

function namedRangeStruct = createNamedRange(name, oneBasedRange)
    namedRangeStruct = struct(name = name, range = convertRange(oneBasedRange));
end

function scopedNamedRangeStruct = createScopedNamedRange(name, oneBasedRange, isPublic)
    scopedNamedRangeStruct = struct(name = name, range = convertRange(oneBasedRange), isPublic = isPublic);
end

function sectionStruct = createSection(name, oneBasedRange, isExplicit)
    sectionStruct = struct(name = name, range = convertRange(oneBasedRange), isExplicit = isExplicit);
end

function zeroBasedRange = convertRange(oneBasedRange)
    zeroBasedRange = oneBasedRange - 1;
end
