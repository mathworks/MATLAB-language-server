% Copyright 2025 The MathWorks, Inc.

function edit(varargin)
    mlock
    persistent originalEdit;

    if nargin == 2 && ischar(varargin{1}) && isequal(varargin{1}, '__SET__')
        originalEdit = varargin{2}{1};
        return;
    end

    if (isempty(originalEdit))
        error('MATLAB:edit:UninitializedShadow', ...
            'MATLAB Language Server - Edit shadow is uninitialized.');
    end

    if (nargin == 0 && ~settings().matlab.editor.UseMATLABEditor.ActiveValue)
        error('MATLAB:edit:NoArgsNotAllowed', ...
            'Calling `edit` with no arguments is not supported when opening files outside of MATLAB.');
    end

    originalEdit(varargin{:});
end
