function codeData = parseInfoFromDocument (code, filePath, analysisLimit)
    % PARSEINFOFROMDOCUMENT Parses the given MATLAB code and extracts information about
    % variables, functions, etc.

    % Copyright 2025 The MathWorks, Inc.

    codeData = matlabls.internal.computeCodeData(code, filePath, analysisLimit);
end
