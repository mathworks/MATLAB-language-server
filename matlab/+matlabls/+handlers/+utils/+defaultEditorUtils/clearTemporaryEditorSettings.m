% Copyright 2025 The MathWorks, Inc.

% Clears any temporary changes made in matlab.editor settings associated with the matlab.defaultEditor config
function clearTemporaryEditorSettings()
    s = settings;
    if hasTemporaryValue(s.matlab.editor.UseMATLABEditor)
        clearTemporaryValue(s.matlab.editor.UseMATLABEditor);
        clearTemporaryValue(s.matlab.editor.OtherEditor);
    end
end