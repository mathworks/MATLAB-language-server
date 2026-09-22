function p = qualifiedNameToPath(baseFolder, qualifiedName)

    % Copyright 2026 The MathWorks, Inc.

    parts = strsplit(qualifiedName, '.');
    folders = strcat('+', parts(1:end-1));
    p = fullfile(baseFolder, folders{:}, [parts{end} '.m']);

    if ~isfile(p)
        resolved = which(qualifiedName);
        if ~isempty(resolved) && isfile(resolved)
            p = resolved;
        end
    end
end
