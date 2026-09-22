function response = getVariablePage(varName, startRow, startCol, workspace)
    %GETVARIABLEPAGE Return a page of data and metadata for a variable.
    %
    % response = getVariablePage("A", 1, 1)
    % response = getVariablePage("T", 1, 1, "base")
    %
    % startRow and startCol are 1-based indices specifying the top-left
    % corner of the page window into the variable's data.

    % Copyright 2026 The MathWorks, Inc.

    if nargin < 4
        workspace = "base";
    end

    if ~isMATLABReleaseOlderThan("R2027b")
        response = getPage(varName, startRow, startCol, workspace);
    else
        response = getPageLegacy(varName, startRow, startCol, workspace);
    end
end

%% Constants

function [rows, cols] = pageSize()
    rows = 50;
    cols = 20;
end

%% Support checks

function tf = isResponseSupported(response)
    metadata = response.metadata;
    supportedClasses = ["double","single","int8","int16","int32","int64","uint8","uint16","uint32","uint64","logical","table"];

    % Only 2D data is currently supported — check for sparse, tall, and N-D matrices
    tf = ismember(metadata.dataType, supportedClasses) ...
        && ~metadata.isSparse ...
        && ~metadata.isTall ...
        && numel(metadata.size) <= 2;
end

%% R2027a+ path — delegates to the internal pipeline
function response = getPage(varName, startRow, startCol, workspace)
    [pageRows, pageCols] = pageSize();
    response = matlab.datatools.uiservices.variabledisplay.internal.pipeline.getVariableView(...
        varName, ...
        Workspace=workspace, ...
        StartRow=startRow, ...
        StartCol=startCol, ...
        FlattenColumns=true, ...
        PageSize=[pageRows, pageCols], ...
        MetadataFcn=@addSparseTallFlags);

    if ~isResponseSupported(response)
        response.preview = unsupportedPreview(evalin(workspace, varName));
    end
end

function metadata = addSparseTallFlags(metadata, varValue)
    metadata.isSparse = issparse(varValue);
    metadata.isTall = istall(varValue);
end

%% Legacy path — evalin once, build metadata, return cells or preview
function response = getPageLegacy(varName, startRow, startCol, workspace)
    [pageRows, pageCols] = pageSize();

    varValue = evalin(workspace, varName);

    response.metadata.size = size(varValue);
    response.metadata.dataType = string(class(varValue));
    response.metadata = addSparseTallFlags(response.metadata, varValue);

    if ~isResponseSupported(response)
        response.preview = unsupportedPreview(varValue);
        return
    end

    if istable(varValue)
        response = buildTablePage(response, varValue, startRow, startCol, pageRows, pageCols);
    else
        response = buildNumericPage(response, varValue, startRow, startCol, pageRows, pageCols);
    end
end

function response = buildNumericPage(response, varValue, startRow, startCol, pageRows, pageCols)
    [nRows, nCols] = size(varValue);

    if nRows == 0 || nCols == 0
        return
    end

    startRow = max(1, startRow);
    startCol = max(1, startCol);

    if startRow > nRows || startCol > nCols
        error('getVariablePage:OutOfBounds', 'Requested page starts outside array bounds.');
    end

    endRow = min(startRow + pageRows - 1, nRows);
    endCol = min(startCol + pageCols - 1, nCols);

    page = varValue(startRow:endRow, startCol:endCol);
    if islogical(page)
        page = double(page);
    end
    response.cells.data = string(page);
    response.cells.startRow = startRow;
    response.cells.startCol = startCol;
end

function response = buildTablePage(response, varValue, startRow, startCol, pageRows, pageCols)
    [nRows, nCols] = size(varValue);
    varNames = varValue.Properties.VariableNames;
    rowNames = varValue.Properties.RowNames;

    if nRows == 0 || nCols == 0
        for curCol = 1:min(pageCols, nCols)
            response.columns.labels(curCol).id = string(curCol);
            response.columns.labels(curCol).name = string(varNames{curCol});
        end
        return
    end

    startRow = max(1, startRow);
    startCol = max(1, startCol);

    if startRow > nRows || startCol > nCols
        error('getVariablePage:OutOfBounds', 'Requested page starts outside table bounds.');
    end

    endRow = min(startRow + pageRows - 1, nRows);
    endCol = min(startCol + pageCols - 1, nCols);

    % Column labels — scoped to the page window
    for curCol = startCol:endCol
        localCol = curCol - startCol + 1;
        response.columns.labels(localCol).id = string(curCol);
        response.columns.labels(localCol).name = string(varNames{curCol});
    end

    % Row labels — scoped to the page window, only when table has RowNames
    if ~isempty(rowNames)
        for curRow = startRow:endRow
            localRow = curRow - startRow + 1;
            response.rows.labels(localRow).id = string(curRow);
            response.rows.labels(localRow).name = string(rowNames{curRow});
        end
    end

    % Flatten each cell to a display string
    cellData = strings(endRow - startRow + 1, endCol - startCol + 1);
    for c = startCol:endCol
        for r = startRow:endRow
            val = varValue{r, c};
            if iscell(val) && isscalar(val)
                val = val{1};
            end
            cellData(r - startRow + 1, c - startCol + 1) = flattenValue(val);
        end
    end

    response.cells.data = cellData;
    response.cells.startRow = startRow;
    response.cells.startCol = startCol;
end

function s = unsupportedPreview(val)
    s = strtrim(formattedDisplayText(val, 'SuppressMarkup', true));
end

function s = flattenValue(val)
    if (isstring(val) && isscalar(val)) || ischar(val)
        s = string(val);
    elseif islogical(val) && isscalar(val)
        if val
            s = "true";
        else
            s = "false";
        end
    elseif isnumeric(val) && isscalar(val)
        s = string(num2str(val));
    elseif isscalar(val) && (isdatetime(val) || isduration(val) || iscalendarduration(val) || iscategorical(val))
        s = string(val);
    else
        s = strjoin(string(size(val)), "x") + " " + string(class(val));
    end
end
