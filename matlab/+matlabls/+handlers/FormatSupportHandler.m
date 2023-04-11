classdef (Hidden) FormatSupportHandler < matlabls.handlers.FeatureHandler
    % FORMATSUPPORTHANDLER The feature handler for the "Format Document" feature.
    % In the future, this may be expanded to include the "Format Selection" feature as well.

    % Copyright 2022 - 2023 The MathWorks, Inc.

    properties (Access = private)
        RequestChannel = "/matlabls/formatDocument/request"
        ResponseChannel = "/matlabls/formatDocument/response"
    end

    methods
        function this = FormatSupportHandler (commManager)
            this = this@matlabls.handlers.FeatureHandler(commManager);
            this.RequestSubscriptions = this.CommManager.subscribe(this.RequestChannel, @this.handleFormatRequest);
        end
    end

    methods (Access = private)
        function handleFormatRequest (this, msg)
            % Handles format document requests
            codeToFormat = msg.data;

            s = settings;

            % Update settings (temporarily) for formatting
            cleanupObj1 = setTemporaryValue(s.matlab.editor.tab.InsertSpaces, msg.insertSpaces); %#ok<NASGU> 
            cleanupObj2 = setTemporaryValue(s.matlab.editor.tab.TabSize, msg.tabSize); %#ok<NASGU>
            cleanupObj3 = setTemporaryValue(s.matlab.editor.tab.IndentSize, msg.tabSize); %#ok<NASGU>

            % Format code
            response.data = indentcode(codeToFormat, 'matlab'); % This will pull from the user's MATLAB® settings.

            % Send formatted code
            this.CommManager.publish(this.ResponseChannel, response)
        end
    end
end

function cleanupObj = setTemporaryValue (setting, tempValue)
    if setting.hasTemporaryValue
        originalValue = setting.TemporaryValue;
        cleanupObj = onCleanup(@() setTempValue(setting, originalValue));
    else
        cleanupObj = onCleanup(@() setting.clearTemporaryValue);
    end

    setTempValue(setting, tempValue);

    function setTempValue (setting, tempValue)
        setting.TemporaryValue = tempValue;
    end
end
