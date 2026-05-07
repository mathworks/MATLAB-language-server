function openProject (projectPath)
    % Opens a MATLAB project from the specified path. The path can represent
    % either a MATLAB project definition file (*.prj or matlab.toml), or a
    % folder containing one.

    % Copyright 2026 The MathWorks, Inc.
    matlab.project.loadProject(projectPath);
end