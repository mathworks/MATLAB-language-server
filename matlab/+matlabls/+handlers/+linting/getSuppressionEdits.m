function suppressionEdits = getSuppressionEdits(code, diagnosticId, diagnosticLine, suppressInFile)
    % GETSUPPRESSIONEDITS Gets the edits required to suppress the given linting diagnostic.

    % Copyright 2025 The MathWorks, Inc.

    if suppressInFile
        diagnosticId = strcat('*', diagnosticId);
    end

    suppressionEdits = matlabls.internal.getDiagnosticSuppressionEdits(code, diagnosticId, diagnosticLine);
end
