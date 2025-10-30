function startupHelper()
    % This function is triggered when MATLAB code
    % execution from the language server becomes available.

    % Copyright 2025 The MathWorks, Inc.

    % Stop and destroy the shutdown timer to prevent MATLAB from exiting.
    t = timerfind('Name', '__MATLABLS_EXIT_TIMER__');
    if ~isempty(t)
        stop(t);
        delete(t);
        disp('matlabls: Exit timer successfully stopped and deleted')
    end
end
