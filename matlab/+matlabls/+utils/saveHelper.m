function saveHelper(filePath)
    % This function is triggered after documents are saved, and can be used to
    % trigger behaviors when this occurs.

    % Copyright 2025 The MathWorks, Inc.

    % Ensure that changes to the file are registered by MATLAB to prevent cached
    % file contents from being used during execution.
    fschange(filePath);
    clear(filePath);
end
