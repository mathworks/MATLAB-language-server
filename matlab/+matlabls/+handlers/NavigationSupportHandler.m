classdef (Hidden) NavigationSupportHandler < matlabls.handlers.FeatureHandler
    % NAVIGATIONHANDLER The feature handler to support navigation workflows.

    % Copyright 2022 - 2023 The MathWorks, Inc.

    properties (Access = private)
        ResolvePathRequestChannel = '/matlabls/navigation/resolvePath/request'
        ResolvePathResponseChannel = '/matlabls/navigation/resolvePath/response'
    end

    methods
        function this = NavigationSupportHandler (commManager)
            this = this@matlabls.handlers.FeatureHandler(commManager);
            this.RequestSubscriptions = this.CommManager.subscribe(this.ResolvePathRequestChannel, @this.handleResolvePathRequest);
        end
    end

    methods (Access = private)
        function handleResolvePathRequest (this, msg)
            % Handles requests to resolve file paths from code identifiers

            names = msg.names;
            contextFile = msg.contextFile;

            response.data = cell(1, numel(names));
            for n = 1:numel(names)
                name = names{n};
                path = matlabls.internal.resolvePath(name, contextFile);
                response.data{n} = struct(name = name, path = path);
            end

            % For any names which are not found, try CDing to the context
            % file's directory and searching again
            sArray = [response.data{:}];
            missingPaths = cellfun(@isempty, {sArray.path});
            missingIndices = find(missingPaths);

            if ~isempty(missingIndices)
                returnDir = cdToPackageRoot(contextFile);
                for n = missingIndices
                    path = matlabls.internal.resolvePath(names{n}, contextFile);
                    if ~isempty(path)
                        response.data{n}.path = path;
                    end
                end
                cd(returnDir);
            end

            this.CommManager.publish(this.ResolvePathResponseChannel, response);
        end
    end
end

function returnDir = cdToPackageRoot (filePath)
    % Given a file path, CDs to the directory at the root-level of the
    % file's package structure. If the file is not within a package,
    % this CDs to the file's directory.

    splitDirs = strsplit(fileparts(filePath), filesep);

    % Determine how far up the path we need to CD
    lastInd = numel(splitDirs);
    while lastInd > 1
        if ~startsWith(splitDirs(lastInd), '+')
            break;
        end
        lastInd = lastInd - 1;
    end

    returnDir = cd(strjoin(splitDirs(1:lastInd), filesep));
end
