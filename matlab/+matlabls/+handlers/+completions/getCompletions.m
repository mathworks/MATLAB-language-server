function completionsData = getCompletions(code, fileName, cursorPosition)
    % GETCOMPLETIONS Retrieves the data for the possible completions at the cursor position in the given code.

    % Copyright 2025 The MathWorks, Inc.
    [~, ~, ext] = fileparts(fileName);
    if ~isempty(fileName) && ~strcmpi(ext, '.m')
        % Expected .m file extension
        error('MATLAB:vscode:invalidFileExtension', 'The provided file must have a .m extension to process completions.');
    end

    completionResultsStr = matlabls.internal.getCompletionsData(code, fileName, cursorPosition);
    completionsData = filterCompletionResults(completionResultsStr);
end

function compResultsStruct = filterCompletionResults (completionResultsStr)
    completionResults = jsondecode(completionResultsStr);

    compResultsStruct = struct;
    propsToKeep = ["widgetData", "widgetType", "signatures"];

    for prop = propsToKeep
        if isfield(completionResults, prop)
            compResultsStruct.(prop) = completionResults.(prop);
        end
    end
end
