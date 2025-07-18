function restoredefaultpath(varargin)
    mlock
    persistent originalRestoreDefaultPath;
    persistent pathUpdateFunction;
    if nargin == 3 && ischar(varargin{1}) && isequal(varargin{1}, 'SET')
        originalRestoreDefaultPath = varargin{2};
        pathUpdateFunction = varargin{3};
        return;
    end

    if isempty(originalRestoreDefaultPath)
        error('Matlab Language Server - RestoreDefaultPath shadow is uninitialized.');
    end

    originalRestoreDefaultPath();
    pathUpdateFunction();
end
