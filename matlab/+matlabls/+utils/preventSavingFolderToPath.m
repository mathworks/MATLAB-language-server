function preventSavingFolderToPath (folder)
    % Prevents the provided folder from being saved to the MATLAB path
    % when the `addpath` function is called.
    %
    % If `folder` represents a semicolon-delimited list of paths (e.g.
    % from `genpath`), each path is added to the excluded list.

    % Copyright 2025 The MathWorks, Inc.
    folders = strsplit(folder, ';');
    for f = folders
        if strlength(f) > 0
            doPreventSavePath(f)
        end
    end
end

function doPreventSavePath (folder)
    if isMATLABReleaseOlderThan('R2024a')
        matlab.internal.language.ExcludedPathStore.getInstance.setExcludedPathEntry(folder);
    else
        matlab.internal.path.ExcludedPathStore.addToCurrentExcludeList(folder);
    end
end
