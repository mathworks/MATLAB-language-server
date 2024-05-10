classdef (Hidden) FoldingSupportHandler < matlabls.handlers.FeatureHandler
    % FOLDINGSUPPORTHANDLER The feature handler for retrieving a document's
    % folding ranges.

    % Copyright 2024 The MathWorks, Inc.


    properties (Access = private)
        RequestChannel = "/matlabls/foldDocument/request"
        ResponseChannel = "/matlabls/foldDocument/response"
    end

    methods
        function this = FoldingSupportHandler ()
            this = this@matlabls.handlers.FeatureHandler();
            this.RequestSubscriptions = matlabls.internal.CommunicationManager.subscribe(this.RequestChannel, @this.handleFoldingRangeRequest);
        end
    end

    methods (Access = private)
        function handleFoldingRangeRequest (this, msg)
            % Handles folding range requests
            codeToFold = msg.code;

            fRangesArray = matlabls.internal.getFoldingRanges(codeToFold);
            response.data = fRangesArray;

            % Send folding ranges
            responseChannel = strcat(this.ResponseChannel, '/', msg.channelId);
            matlabls.internal.CommunicationManager.publish(responseChannel, response.data)
        end
    end
end
