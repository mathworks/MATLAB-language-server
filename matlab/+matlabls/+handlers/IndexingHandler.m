classdef (Hidden) IndexingHandler < matlabls.handlers.FeatureHandler
    % INDEXINGHANDLER The feature handler for indexing documents for variable,
    % function, and class references and definitions.

    % Copyright 2022 - 2023 The MathWorks, Inc.

    properties (Access = private)
        DocumentIndexingRequestChannel = '/matlabls/indexDocument/request'
        DocumentIndexingResponseChannel = '/matlabls/indexDocument/response/' % Needs to be appended with requestId

        FolderIndexingRequestChannel = '/matlabls/indexFolders/request'
        FolderIndexingResponseChannel = '/matlabls/indexFolders/response/' % Needs to be appended with requestId
    end

    methods
        function this = IndexingHandler (commManager)
            this = this@matlabls.handlers.FeatureHandler(commManager);
            this.RequestSubscriptions(end + 1) = this.CommManager.subscribe(this.DocumentIndexingRequestChannel, @this.handleDocumentIndexRequest);
            this.RequestSubscriptions(end + 1) = this.CommManager.subscribe(this.FolderIndexingRequestChannel, @this.handleFolderIndexRequest);
        end
    end

    methods (Access = private)
        function handleDocumentIndexRequest (this, msg)
            % Indexes an individual document and provides the raw data.

            code = msg.code;
            filePath = msg.filePath;
            requestId = num2str(msg.requestId);

            codeData = matlabls.internal.computeCodeData(code, filePath);

            responseChannel = strcat(this.DocumentIndexingResponseChannel, requestId);
            this.CommManager.publish(responseChannel, codeData)
        end

        function handleFolderIndexRequest (this, msg)
            % Indexes M-files the provided folders

            folders = msg.folders;
            requestId = num2str(msg.requestId);

            files = this.getAllMFilesToIndex(folders);
            this.parseFiles(requestId, files)
        end

        function filesToIndex = getAllMFilesToIndex (~, folders)
            % Gathers a list of all M files within the given folders.

            filesToIndex = [];

            for n = 1:numel(folders)
                fileListing = dir([folders{n} '/**/*.m']);
                fileNames = strings(numel(fileListing), 1);
                for m = 1:numel(fileListing)
                    fileNames(m) = fullfile(fileListing(m).folder, fileListing(m).name);
                end
                filesToIndex = [filesToIndex; fileNames]; %#ok<AGROW>
            end
        end

        function parseFiles (this, requestId, files)
            % Processes the given list of files and sends the data back to the language server.

            if isMATLABReleaseOlderThan('R2021b')
                % If backgroundPool doesn't exist, leverage a timer to avoid blocking thread
                this.doParseFilesWithTimer(this, requestId, files);
            else
                parfeval(backgroundPool, @this.doParseFiles, 0, requestId, files);
            end
        end

        function doParseFilesWithTimer (this, requestId, files, index)
            % This leverages a timer to achieve an "asynchronous" looping effect, allowing
            % other operations to take place between parsing each file. This prevents the MATLAB®
            % thread from becomming blocked for an extended period of time.

            if nargin == 3
                index = 1;
            end

            filePath = files(index);
            isLastFile = index == numel(files);

            this.parseFile(requestId, filePath, isLastFile);

            if ~isLastFile
                % More files - queue next file to parse
                t = timer(TimerFcn = @timerCallback, StartDelay = 0.001);
                t.start();
            end

            function timerCallback (t, ~)
                % Destroy existing timer
                t.stop();
                t.delete();

                % Parse next file
                this.parseFiles(requestId, files, index + 1);
            end
        end

        function doParseFiles (this, requestId, files)
            % This can be executed in a separate thread (e.g. parfeval) to avoid blocking the
            % MATLAB thread.

            for n = 1:numel(files)
                filePath = files{n};
                isLastFile = n == numel(files);
                this.parseFile(requestId, filePath, isLastFile);
            end
        end

        function parseFile (this, requestId, filePath, isLastFile)
            % Parses the given file and sends its data back to the language server

            code = fileread(filePath);
            codeData = matlabls.internal.computeCodeData(code, filePath);

            % Send data for this file
            msg.filePath = filePath;
            msg.codeData = codeData;

            if isLastFile
                msg.isDone = true;
            else
                msg.isDone = false;
            end

            responseChannel = strcat(this.FolderIndexingResponseChannel, requestId);
            this.CommManager.publish(responseChannel, msg);
        end
    end
end
