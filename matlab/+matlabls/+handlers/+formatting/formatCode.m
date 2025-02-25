function formattedCode = formatCode (codeToFormat, options)
    % FORMATCODE Formats the given MATLAB code according to the specified options.

    % Copyright 2025 The MathWorks, Inc.

    s = settings;

    % Update settings (temporarily) for formatting
    cleanupObj1 = setTemporaryValue(s.matlab.editor.tab.InsertSpaces, options.insertSpaces); %#ok<NASGU> 
    cleanupObj2 = setTemporaryValue(s.matlab.editor.tab.TabSize, options.tabSize); %#ok<NASGU>
    cleanupObj3 = setTemporaryValue(s.matlab.editor.tab.IndentSize, options.tabSize); %#ok<NASGU>

    % Format code
    formattedCode = indentcode(codeToFormat);
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
