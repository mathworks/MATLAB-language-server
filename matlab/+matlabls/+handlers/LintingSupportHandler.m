classdef (Hidden) LintingSupportHandler < matlabls.handlers.FeatureHandler
    % LINTINGSUPPORTHANDLER The feature handler for linting MATLAB® code.

    % Copyright 2022 - 2023 The MathWorks, Inc.

    properties (Access = private)
        LintingRequestChannel = '/matlabls/linting/request'
        LintingResponseChannel = '/matlabls/linting/response'

        FindStatementEndRequestChannel = '/matlabls/linting/findstatementend/request'
        FindStatementEndResponseChannel = '/matlabls/linting/findstatementend/response'
    end

    methods
        function this = LintingSupportHandler (commManager)
            this = this@matlabls.handlers.FeatureHandler(commManager);
            this.RequestSubscriptions(1) = this.CommManager.subscribe(this.LintingRequestChannel, @this.handleLintingRequest);
            this.RequestSubscriptions(2) = this.CommManager.subscribe(this.FindStatementEndRequestChannel, @this.handleFindStatementEndRequest);
        end
    end

    methods (Access = private)
        function handleLintingRequest (this, msg)
            % Gathers linting data for the provided code.

            code = msg.code;
            fileName = msg.fileName;

            response.lintData = checkcode('-text', code, fileName, '-id', '-severity', '-fix', '-string');
            response.lintData = split(deblank(response.lintData), newline);
            response.lintData(cellfun(@isempty, response.lintData)) = [];

            this.CommManager.publish(this.LintingResponseChannel, response)
        end

        function handleFindStatementEndRequest (this, msg)
            % For the provided code, find the last line (1-based) of the
            % statement containing the provided line number (1-based).
            % For example, takes into account line continuations (...).
            %
            % This is used to determine where linting suppressions ("%#ok<...>")
            % should be inserted.

            code = msg.code;
            lineNumber = msg.lineNumber;

            response.lineNumber = matlabls.internal.findStatementEndLine(code, lineNumber);

            this.CommManager.publish(this.FindStatementEndResponseChannel, response)
        end
    end
end
