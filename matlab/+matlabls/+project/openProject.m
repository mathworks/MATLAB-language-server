function openProject (projectPath)
    % Opens a MATLAB project from the specified path. The path can represent
    % either a MATLAB project definition file (*.prj or matlab.toml), or a
    % folder containing one.

    % Copyright 2026 The MathWorks, Inc.
    matlabls.internal.CommunicationManager.publish("/matlabls/events/input", struct("promptString", "Do you want to continue? [YES/no]:"));
    matlab.project.loadProject(projectPath);
    matlabls.internal.CommunicationManager.publish("/matlabls/events/input", struct("promptString", "? ")); % Clear the prompt string

    % Check if the project failed to open (e.g. if the user declined the prompt)
    if isempty(matlab.project.rootProject())
        % Notify that a project is closed (no longer opening)
        event = struct(Event = "closed");
        matlabls.internal.CommunicationManager.publish("/matlabls/project/event", event);
    end
end
