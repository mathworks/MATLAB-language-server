function formattedCode = formatCode (code, startLine, endLine, options)
    % FORMATCODE Formats the specifid line range of the given MATLAB
    % code according to the provided options.
    %
    % Note: `startLine` and `endLine` should be provided as 0-based line numbers.

    % Copyright 2025 The MathWorks, Inc.

    % Update settings (temporarily) for formatting
    s = settings;
    cleanupObj1 = setTemporaryValue(s.matlab.editor.tab.InsertSpaces, options.insertSpaces); %#ok<NASGU> 
    cleanupObj2 = setTemporaryValue(s.matlab.editor.tab.TabSize, options.tabSize); %#ok<NASGU>
    cleanupObj3 = setTemporaryValue(s.matlab.editor.tab.IndentSize, options.tabSize); %#ok<NASGU>

    % Formatting logic expects 1-based line numbers
    formattedCode = doFormatLines(code, startLine + 1, endLine + 1, options);
end

function formattedCode = doFormatLines (code, startLine, endLine, options)
    % Standardize line endings to \n
    code = regexprep(code , sprintf('(\r\n)|\r|\n'), newline);

    lines = strsplit(code, newline, CollapseDelimiters = false);

    % Determine the range of lines to format
    if startLine == 1
        % Case 1: start is the first code line
        linesToFormat = lines(startLine:endLine);
    else
        % Case 2: start is not the first code line
        % In this case, we include the preceding line when formatting to
        % ensure the indentation of startLine is correct with respect to
        % the previous line.
        linesToFormat = lines(startLine-1:endLine);
    end

    % Format the lines using the indentcode function
    formattedCode = indentcode(strjoin(linesToFormat, '\n'));
    formattedLines = strsplit(formattedCode, '\n', CollapseDelimiters = false);

    % Replace the respective lines in the original snippet
    if startLine == 1
        lines(startLine:endLine) = formattedLines;
    else
        % Calculate the difference in indentation
        originalIndent = regexp(lines{startLine-1}, '^\s*', 'match', 'once');
        newIndent = regexp(formattedLines{1}, '^\s*', 'match', 'once');
        diff = getWhitespaceLength(originalIndent, options.tabSize) - getWhitespaceLength(newIndent, options.tabSize);

        if diff ~= 0
            % Adjust whitespace indent of formatted lines [startLine:endLine]
            for i = 2:numel(formattedLines)
                if options.insertSpaces
                    formattedLines{i} = append(getWhitespaceStringOfLength(diff, true, options.tabSize), formattedLines{i});
                else
                    existingWhitespace = regexp(formattedLines{i}, '^\s*', 'match', 'once');
                    existingWhitespaceLength = getWhitespaceLength(existingWhitespace, options.tabSize);
                    targetWhitespaceLength = existingWhitespaceLength + diff;

                    newWhitespace = getWhitespaceStringOfLength(targetWhitespaceLength, false, options.tabSize);
                    formattedLines{i} = append(newWhitespace, strip(formattedLines{i}, 'left'));
                end
            end
        end

        % Replace the formatted lines
        lines(startLine:endLine) = formattedLines(2:end);
    end

    % Join the lines back into a single string
    formattedCode = strjoin(lines, '\n');
end

function lengthInSpaces = getWhitespaceLength (whitespaceStr, tabSize)
    lengthInSpaces = 0;

    % Iterate through each character in the string
    for i = 1:length(whitespaceStr)
        charAtPos = whitespaceStr(i);

        if charAtPos == ' '
            % Space character - add length of 1
            lengthInSpaces = lengthInSpaces + 1;
        else
            % Assume tab character
            % The length will now be the next multiple of `tabSize`
            lengthInSpaces = floor(lengthInSpaces / tabSize + 1) * tabSize;
        end
    end
end

function whitespaceStr = getWhitespaceStringOfLength (length, insertSpaces, tabSize)
    if insertSpaces
         whitespaceStr = blanks(length);
    else
        % Calculate how many tab characters and additional spaces are needed
        nTabs = floor(length / tabSize);
        nSpaces = rem(length, tabSize);
        whitespaceStr = append(repmat(char(9), 1, nTabs), blanks(nSpaces));
    end
end

function cleanupObj = setTemporaryValue (setting, tempValue)
    if setting.hasTemporaryValue
        originalValue = setting.TemporaryValue;
        cleanupObj = onCleanup(@() setTempValue(setting, originalValue));
    else
        cleanupObj = onCleanup(@() setting.clearTemporaryValue);
    end

    setTempValue(setting, tempValue);

    function setTempValue (setting, tempValue)
        setting.TemporaryValue = tempValue;
    end
end
