function clc
    %CLC    Clear command window.
    %   CLC clears the command window and homes the cursor.
    %
    %   See also HOME.

    % Copyright 2024 The MathWorks, Inc.

    builtin('clc');
    matlabls.internal.CommunicationManager.publish('/matlabls/events/clc', struct());
end
