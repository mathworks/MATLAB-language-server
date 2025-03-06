function parseInfoFromFolder (folders, analysisLimit, responseChannel)
    % PARSEINFOFROMFOLDER Parses the MATLAB files in the provided folders and extracts
    % information about variables, functions, etc.
    %
    % Instead of returning the parsed results, this function will stream those results
    % over the response channel. This allows for these files to be processed without
    % blocking the MATLAB thread for the full duration.

    % Copyright 2025 The MathWorks, Inc.

    filesToParse = getAllMFilesToParse(folders);
    parfeval(backgroundPool, @doParseFiles, 0, filesToParse, analysisLimit, responseChannel);
end

function filesToParse = getAllMFilesToParse (folders)
    % Gathers a list of all M files within the given folders

    filesToParse = [];

    for n = 1:numel(folders)
        fileListing = dir([folders{n} '/**/*.m']);
        fileNames = strings(numel(fileListing), 1);
        for m = 1:numel(fileListing)
            fileNames(m) = fullfile(fileListing(m).folder, fileListing(m).name);
        end
        filesToParse = [filesToParse; fileNames]; %#ok<AGROW>
    end
end

function doParseFiles (filesToParse, analysisLimit, responseChannel)
    % Processes the given list of files.
    %
    % This can be executed in a separate thread (e.g. parfeval) to avoid blocking
    % the MATLAB thread.

    for n = 1:numel(filesToParse)
        filePath = filesToParse{n};
        isLastFile = (n == numel(filesToParse));
        parseFile(filePath, isLastFile, analysisLimit, responseChannel);
    end
end

function parseFile (filePath, isLastFile, analysisLimit, responseChannel)
    % Parses an individual file and publishes the results over the response channel.
    %
    % If the file to be parsed is the last file, an `isDone` flag on the results is
    % set to true to indicate that the parsing process has completed.

    code = fileread(filePath);
    codeData = matlabls.handlers.indexing.parseInfoFromDocument(code, filePath, analysisLimit);

    % Send data for this file
    msg.filePath = filePath;
    msg.codeData = codeData;
    msg.isDone = isLastFile;

    matlabls.internal.CommunicationManager.publish(responseChannel, msg);
end
