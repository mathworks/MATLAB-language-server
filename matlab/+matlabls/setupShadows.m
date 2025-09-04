function setupShadows(languageServerFolder)
    currentDirectory = pwd;
    cleanup = onCleanup(@() cd(currentDirectory));

    try
        addRestoreDefaultPathShadow(languageServerFolder);
        addEditShadow(languageServerFolder);
        addClcShadow(languageServerFolder);
    catch ME
        disp('Error while attempting to add shadow directories to path')
        disp(ME.message)
    end
end

function addRestoreDefaultPathShadow(languageServerFolder)
    cd(fullfile(matlabroot, 'toolbox', 'local'));
    originalRestoreDefaultPath = @restoredefaultpath;
    cd(matlabroot);
    addpath(fullfile(languageServerFolder, 'shadows', 'restoredefaultpath'));

    restoredefaultpath('__SET__', originalRestoreDefaultPath, @handleReset);

    function handleReset()
        addpath(languageServerFolder)
        matlabls.setupShadows(languageServerFolder)
    end
end

function addEditShadow(languageServerFolder)
    cd(fullfile(matlabroot, 'toolbox', 'matlab', 'codetools'));
    originalEdit = @edit;
    cd(matlabroot);
    addpath(fullfile(languageServerFolder, 'shadows', 'edit'));

    % Need to pass the originalEdit function handle in within a cell array
    % to avoid @function_handle/edit being used instead.
    edit('__SET__', {originalEdit});
end

function addClcShadow(languageServerFolder)
    % Only need to do this for <R2023a
    if isMATLABReleaseOlderThan('R2023a')
        addpath(fullfile(languageServerFolder, 'shadows', 'clc'));
    end
end
