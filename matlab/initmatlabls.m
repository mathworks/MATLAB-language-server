function initmatlabls (outFile)
    % Initializes a MATLAB® session to talk to a MATLAB language server.
    % Writes connection info to the outFile specified by the client

    % Copyright 2022 - 2024 The MathWorks, Inc.

    % Prevent clearing the workspace from cleaning up the MatlabLanguageServerHelper
    mlock

    disp("matlabls: Beginning initialization")
    fprintf("matlabls: matlabroot is \n%s\n", matlabroot)

    % Ensure the language server code is on the path
    folder = fileparts(mfilename("fullpath"));
    addpath(folder)

    if isMATLABReleaseOlderThan('R2023a')
        addpath(fullfile(folder, 'shadows', 'clc'));
    end

    % Create matlabls helper for calculating language server operations
    persistent matlablsHelper %#ok<PUSE>
    matlablsHelper = matlabls.MatlabLanguageServerHelper();

    if nargin == 1
        logConnectionData(outFile)
    end

    disp("matlabls: Initialization complete")
end

function logConnectionData (outFile)
    releaseInfo = matlabRelease;

    data.pid = feature("getpid");
    data.release = releaseInfo.Release;
    data.port = matlabls.internal.CommunicationManager.getSecurePort();
    data.certFile = matlabls.internal.CommunicationManager.getCertificateLocation();
    data.sessionKey = dduxinternal.getSessionKey();

    connectionData = jsonencode(data);

    disp(strcat("Printing connection data to file: ", newline, "    ", outFile))

    % Write data to a temporary file first, then move to the expected filename to
    % avoid a timing issue where partial data may be read from the Node.js layer.
    tmpFileName = strcat(outFile, '-tmp');

    fid = fopen(tmpFileName, "w");
    if (fid == -1)
        error("Failed to create temporary connection file.")
    end

    fprintf(fid, "%s\n", connectionData);
    fclose(fid);

    status = movefile(tmpFileName, outFile);
    if ~status
        error("Failed to rename connection file.")
    end
end
