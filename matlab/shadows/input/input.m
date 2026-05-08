function out = input(varargin)
    %INPUT    Request user input

    % Copyright 2026 The MathWorks, Inc.

    matlabls.internal.CommunicationManager.publish('/matlabls/events/input', struct('promptString', varargin{1}));
    out = builtin('input', varargin{:});
end
