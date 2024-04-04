classdef (Hidden) FeatureHandler < matlab.mixin.Heterogeneous & handle
    %FEATUREHANDLER Serves as the base class for all feature handlers.

    % Copyright 2022 - 2024 The MathWorks, Inc.

    properties
        RequestSubscriptions (1,:) uint64 % Holds references to subscriptions
    end

    methods
        function close (this)
            arrayfun(@(subRef) matlabls.internal.CommunicationManager.unsubscribe(subRef), this.RequestSubscriptions)
        end

        function destroy (this)
            this.close()
        end
    end
end
