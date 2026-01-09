function initmatlabls (outFile)
    % Initializes a MATLAB® session to talk to a MATLAB language server.
    % Writes connection info to the outFile specified by the client

    % Copyright 2022 - 2025 The MathWorks, Inc.

    try
        disp('matlabls: Beginning initialization')
        fprintf('matlabls: matlabroot is \n%s\n', matlabroot)

        % Ensure the language server code is on the path, but cannot be saved to the path
        folder = fileparts(mfilename('fullpath'));
        matlabls.utils.preventSavingFolderToPath(genpath(folder));

        % Shadow necessary functions
        matlabls.setupShadows(folder);
        
        try
            s = settings;
            s.matlab.editor.OpenFileAtBreakpoint.TemporaryValue = false;
            s.matlab.editor.ReopenFilesOnRestart.TemporaryValue = false;
        catch ME
        end

        % Initialize communication manager
        matlabls.internal.CommunicationManager.initialize();
        
        if nargin == 1
            logConnectionData(outFile)
        end

        disp('matlabls: Initialization complete')
    catch ME
        disp('matlabls: Initialization errored:')
        disp(getReport(ME))
    end

    % Set up a timer to exit MATLAB as a precaution to prevent leaking
    % this instance if something goes wrong in the language server.
    % This timer will be cleared as soon as the MVM becomes available.
    t = timer( ...
        Name = '__MATLABLS_EXIT_TIMER__', ...
        StartDelay = 5 * 60, ... 5 minutes
        ExecutionMode = 'singleShot', ...
        TimerFcn = @exitCallback ...
    );
    start(t);
end

function logConnectionData (outFile)
    data.pid = feature('getpid');
    data.port = matlabls.internal.CommunicationManager.getSecurePort();
    data.certFile = matlabls.internal.CommunicationManager.getCertificateLocation();
    try
        releaseInfo = matlabRelease;
        data.release = releaseInfo.Release;
    catch
        data.release = ['R' version('-release')];
    end
    try
        data.sessionKey = dduxinternal.getSessionKey();
    catch
        data.sessionKey = 'Unknown - MATLAB too old';
    end

    connectionData = jsonencode(data);

    disp(strcat('Printing connection data to file: ', newline, '    ', outFile))

    % Write data to a temporary file first, then move to the expected filename to
    % avoid a timing issue where partial data may be read from the Node.js layer.
    tmpFileName = strcat(outFile, '-tmp');

    fid = fopen(tmpFileName, 'w');
    if (fid == -1)
        error('Failed to create temporary connection file.')
    end

    fprintf(fid, '%s\n', connectionData);
    fclose(fid);

    status = movefile(tmpFileName, outFile);
    if ~status
        error('Failed to rename connection file.')
    end
end

function exitCallback (t, ~)
    stop(t)
    delete(t)
    disp('Exiting MATLAB due to connection failure')
    exit()
end
