classdef (Hidden) PathSynchronizerHandler < matlabls.handlers.FeatureHandler
    % PATHSYNCHRONIZERHANDLER The feature handler to support synchronizing the MATLAB path
    % with the client's workspace. This provides access points to add and remove from the path,
    % as well as get/set MATLAB's current working directory.

    % Copyright 2024 The MathWorks, Inc.

    properties (Access = private)
        CdRequestChannel = "/matlabls/pathSynchronizer/cd/request"

        PwdRequestChannel = "/matlabls/pathSynchronizer/pwd/request"
        PwdResponseChannel = "/matlabls/pathSynchronizer/pwd/response"

        AddPathRequestChannel = "/matlabls/pathSynchronizer/addpath/request"
        RmPathRequestChannel = "/matlabls/pathSynchronizer/rmpath/request"
    end

    methods
        function this = PathSynchronizerHandler ()
            this.RequestSubscriptions(1) = matlabls.internal.CommunicationManager.subscribe(this.CdRequestChannel, @this.handleCdRequest);
            this.RequestSubscriptions(2) = matlabls.internal.CommunicationManager.subscribe(this.PwdRequestChannel, @this.handlePwdRequest);
            this.RequestSubscriptions(3) = matlabls.internal.CommunicationManager.subscribe(this.AddPathRequestChannel, @this.handleAddPathRequest);
            this.RequestSubscriptions(4) = matlabls.internal.CommunicationManager.subscribe(this.RmPathRequestChannel, @this.handleRmPathRequest);
        end
    end

    methods (Access = private)
        function handleCdRequest (~, msg)
            path = msg.path;

            try
                cd(path)
            catch e
                disp('Error during `cd` operation:')
                disp(e.message)
            end
        end

        function handlePwdRequest (this, msg)
            try
                currentPath = pwd();

                responseChannel = strcat(this.PwdResponseChannel, '/', msg.channelId);
                matlabls.internal.CommunicationManager.publish(responseChannel, currentPath);
            catch e
                disp('Error during `pwd` operation:')
                disp(e.message)
            end
        end

        function handleAddPathRequest (~, msg)
            paths = msg.paths;
            paths = strjoin(paths, pathsep);

            try
                addpath(paths)
            catch e
                disp('Error during `addpath` operation:')
                disp(e.message)
            end
        end

        function handleRmPathRequest (~, msg)
            paths = msg.paths;
            paths = strjoin(paths, pathsep);

            try
                rmpath(paths)
            catch e
                disp('Error during `rmpath` operation:')
                disp(e.message)
            end
        end
    end
end
