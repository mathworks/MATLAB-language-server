classdef (Hidden) LintingSupportHandler < matlabls.handlers.FeatureHandler
    % LINTINGSUPPORTHANDLER The feature handler for linting MATLAB® code.

    % Copyright 2022 - 2024 The MathWorks, Inc.

    properties (Access = private)
        LintingRequestChannel = '/matlabls/linting/request'
        LintingResponseChannel = '/matlabls/linting/response'

        SuppressDiagnosticRequestChannel = '/matlabls/linting/suppressdiagnostic/request'
        SuppressDiagnosticResponseChannel = '/matlabls/linting/suppressdiagnostic/response'
    end

    methods
        function this = LintingSupportHandler (commManager)
            this = this@matlabls.handlers.FeatureHandler(commManager);
            this.RequestSubscriptions(1) = this.CommManager.subscribe(this.LintingRequestChannel, @this.handleLintingRequest);
            this.RequestSubscriptions(2) = this.CommManager.subscribe(this.SuppressDiagnosticRequestChannel, @this.handleDiagnosticSuppressionRequest);
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

            responseChannel = strcat(this.LintingResponseChannel, '/', msg.channelId);
            this.CommManager.publish(responseChannel, response)
        end

        function handleDiagnosticSuppressionRequest (this, msg)
            % Gets the edit required to suppress the given linting diagnostic

            code = msg.code;
            diagnosticId = msg.diagnosticId;
            diagnosticLine = msg.line;
            suppressInFile = msg.suppressInFile;

            if suppressInFile
                diagnosticId = strcat('*', diagnosticId);
            end

            response.suppressionEdits = matlabls.internal.getDiagnosticSuppressionEdits(code, diagnosticId, diagnosticLine);

            responseChannel = strcat(this.SuppressDiagnosticResponseChannel, '/', msg.channelId);
            this.CommManager.publish(responseChannel, response);
        end
    end
end
