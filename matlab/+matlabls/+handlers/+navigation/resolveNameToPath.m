function resolvedPath = resolveNameToPath(name, contextFile)
    % RESOLVENAMETOPATH Resolves a name (e.g. "plot") to the respective file path which
    % corresponds to the definition of that name.

    % Copyright 2025 The MathWorks, Inc.

    resolvedPath = resolvePath(name, contextFile);

    % If the name is not found, try CDing to the context file's
    % directory and searching again
    if strlength(resolvedPath) == 0
        returnDir = cdToPackageRoot(contextFile);
        resolvedPath = resolvePath(name, contextFile);
        cd(returnDir);
    end
end

function resolvedPath = resolvePath (name, contextFile)
    if isMATLABReleaseOlderThan('R2023b')
        % For usage in R2023a and earlier
        [isFound, resolvedPath] = matlabls.internal.resolvePath(name, contextFile);
    elseif isMATLABReleaseOlderThan('R2024a')
        % For usage in R2023b only
        [isFound, resolvedPath] = matlab.internal.language.introspective.resolveFile(name, []);
    elseif isMATLABReleaseOlderThan('R2024b')
        % For usage in R2024a only
        ec = matlab.lang.internal.introspective.ExecutionContext;
        [isFound, resolvedPath] = matlab.lang.internal.introspective.resolveFile(name, ec);
    else
        % For usage in R2024b and later
        ic = matlab.lang.internal.introspective.IntrospectiveContext.caller;
        [isFound, resolvedPath] = matlab.lang.internal.introspective.resolveFile(name, ic);
    end

    if ~isFound
        resolvedPath = '';
    end
end

function returnDir = cdToPackageRoot (filePath)
    % Given a file path, CDs to the directory at the root-level of the
    % file's package structure. If the file is not within a package,
    % this CDs to the file's directory.

    splitDirs = strsplit(fileparts(filePath), filesep);

    % Determine how far up the path we need to CD
    lastInd = numel(splitDirs);
    while lastInd > 1
        if ~startsWith(splitDirs(lastInd), '+')
            break;
        end
        lastInd = lastInd - 1;
    end

    returnDir = cd(strjoin(splitDirs(1:lastInd), filesep));
end
