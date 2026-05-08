function newProject (projectName, projectPath)
    % Creates a new MATLAB project with the specified name and path

    % Copyright 2026 The MathWorks, Inc.
    matlab.project.createProject("Name", projectName, "Folder", projectPath);
end