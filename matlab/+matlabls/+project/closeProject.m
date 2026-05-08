function closeProject ()
    % Closes the currently open MATLAB project

    % Copyright 2026 The MathWorks, Inc.
    proj = matlab.project.currentProject();
    if ~isempty(proj)
        close(proj);
    end
end