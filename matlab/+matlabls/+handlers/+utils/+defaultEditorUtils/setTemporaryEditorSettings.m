% Copyright 2025 The MathWorks, Inc.

% Temporarily sets default editor to the provided executablePath when matlab.defaultEditor config is enabled using the matlab.editor settings
function setTemporaryEditorSettings(executablePath)
    s = settings;
    s.matlab.editor.UseMATLABEditor.TemporaryValue = 0; 
    s.matlab.editor.OtherEditor.TemporaryValue = executablePath;
end