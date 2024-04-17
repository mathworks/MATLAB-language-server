classdef (Hidden) MatlabLanguageServerHelper < handle
    % MATLABLANGUAGESERVERHELPER Class for managing the MATLAB®-side operations
    % which support the MATLAB Language Server.

    % Copyright 2022 - 2024 The MathWorks, Inc.

    properties
        FeatureHandlers (1,:) matlabls.handlers.FeatureHandler
    end

    methods
        function this = MatlabLanguageServerHelper ()
            matlabls.internal.CommunicationManager.initialize();
            this.initializeFeatureHandlers()
        end

        function close (this)
            arrayfun(@(handler) handler.close(), this.FeatureHandlers)
        end

        function delete (this)
            this.close()
        end
    end

    methods (Access = private)
        function initializeFeatureHandlers (this)
            % Initialize all supported feature handlers
            this.FeatureHandlers(end + 1) = matlabls.handlers.CompletionSupportHandler();
            this.FeatureHandlers(end + 1) = matlabls.handlers.FormatSupportHandler();
            this.FeatureHandlers(end + 1) = matlabls.handlers.IndexingHandler();
            this.FeatureHandlers(end + 1) = matlabls.handlers.LintingSupportHandler();
            this.FeatureHandlers(end + 1) = matlabls.handlers.NavigationSupportHandler();
            this.FeatureHandlers(end + 1) = matlabls.handlers.FoldingSupportHandler();
        end
    end
end
