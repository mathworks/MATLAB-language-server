classdef (Hidden) CompletionSupportHandler < matlabls.handlers.FeatureHandler
    % COMPLETIONSUPPORTHANDLER The feature handler for tab completion and function
    % signature support.

    % Copyright 2022 - 2024 The MathWorks, Inc.

    properties (Access = private)
        RequestChannel = "/matlabls/completions/request"
        ResponseChannel = "/matlabls/completions/response"

        PropsToKeep = ["widgetData" "widgetType" "signatures"]
    end

    methods
        function this = CompletionSupportHandler (commManager)
            this = this@matlabls.handlers.FeatureHandler(commManager);
            this.RequestSubscriptions = this.CommManager.subscribe(this.RequestChannel, @this.handleCompletionRequest);
        end
    end

    methods (Access = private)
        function handleCompletionRequest (this, msg)
            % Handles requests for completion data

            code = msg.code;
            fileName = msg.fileName;
            cursorPosition = msg.cursorPosition;

            completionResultsStr = matlabls.internal.getCompletionsData(code, fileName, cursorPosition);
            filteredResults = this.filterCompletionResults(completionResultsStr);

            responseChannel = strcat(this.ResponseChannel, '/', msg.channelId);
            this.CommManager.publish(responseChannel, filteredResults)
        end

        function compResultsStruct = filterCompletionResults (this, completionResultsStr)
            completionResults = jsondecode(completionResultsStr);

            compResultsStruct = struct;

            for prop = this.PropsToKeep
                if isfield(completionResults, prop)
                    compResultsStruct.(prop) = completionResults.(prop);
                end
            end
        end
    end
end
