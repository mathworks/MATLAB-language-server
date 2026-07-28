function result = discoverTests(paths, mode)
    %DISCOVERTESTS Discover MATLAB unit tests from files or folders.
    %   paths - string array of file/folder paths
    %   mode  - 'file' or 'folder'
    %
    % Returns a struct with fields:
    %   names           - cell array of test name strings
    %   filenames       - cell array of file path strings
    %   procedureNames  - cell array of method name strings
    %   testParentNames - cell array of class name strings
    %   parameterizations - cell array of parameterization strings
    %   error           - '' on success, error message on failure
    %   warning         - '' if no warnings, otherwise warning text from MATLAB

    % Copyright 2026 The MathWorks, Inc.

    try
        lastwarn('');
        suites = cell(1, numel(paths));
        for i = 1:numel(paths)
            if strcmp(mode, 'folder')
                suites{i} = matlab.unittest.TestSuite.fromFolder(paths{i}, ...
                    'IncludingSubfolders', true);
            else
                suites{i} = matlab.unittest.TestSuite.fromFile(paths{i});
            end
        end
        suite = [suites{:}];
        warnMsg = lastwarn;
        warnMsg = regexprep(warnMsg, '<a[^>]*>', '');
        warnMsg = strrep(warnMsg, '</a>', '');

        n = numel(suite);
        names = cell(1, n);
        filenames = cell(1, n);
        procedureNames = cell(1, n);
        testParentNames = cell(1, n);
        parameterizations = cell(1, n);

        for i = 1:n
            fullName = char(suite(i).Name);
            names{i} = fullName;
            procedureNames{i} = char(suite(i).ProcedureName);

            tc = suite(i).TestClass;
            if strlength(tc) > 0
                testParentNames{i} = char(tc);
                filenames{i} = fullfile(char(suite(i).BaseFolder), [char(tc) '.m']);
            else
                parts = strsplit(fullName, '/');
                testParentNames{i} = parts{1};
                filenames{i} = fullfile(char(suite(i).BaseFolder), [parts{1} '.m']);
            end

            parenIdx = strfind(fullName, '(');
            if ~isempty(parenIdx)
                parameterizations{i} = fullName(parenIdx(1)+1:end-1);
            else
                parameterizations{i} = '';
            end
        end

        result.names = names;
        result.filenames = filenames;
        result.procedureNames = procedureNames;
        result.testParentNames = testParentNames;
        result.parameterizations = parameterizations;
        result.error = '';
        result.warning = warnMsg;
    catch ME
        result.names = {};
        result.filenames = {};
        result.procedureNames = {};
        result.testParentNames = {};
        result.parameterizations = {};
        result.error = ME.message;
        result.warning = '';
    end
end
