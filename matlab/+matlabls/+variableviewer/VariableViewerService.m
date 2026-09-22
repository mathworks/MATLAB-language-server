classdef VariableViewerService < handle
    % Pub/sub service for Variable Viewer communication with the VS Code extension.

    % Copyright 2026 The MathWorks, Inc.

    properties (Constant, Access = private)
        ClientChannel = '/VariableViewer/ClientMsg'
        ServerChannel = '/VariableViewer/ServerMsg'
    end

    methods (Static)
        function setupListeners ()
            matlabls.internal.CommunicationManager.subscribe( ...
                matlabls.variableviewer.VariableViewerService.ClientChannel, ...
                @matlabls.variableviewer.VariableViewerService.handleClientMessage);
        end
    end

    methods (Static, Hidden)
        function handleClientMessage (msg)
            try
                switch msg.type
                    case 'QueryVariable'
                        response = matlabls.variableviewer.getVariablePage(msg.varName, 1, 1);
                    case 'QueryPage'
                        response = matlabls.variableviewer.getVariablePage(msg.varName, msg.startRow, msg.startCol);
                end
                response = matlabls.variableviewer.VariableViewerService.buildResponse(response, msg.varName);
                matlabls.internal.CommunicationManager.publish( ...
                    matlabls.variableviewer.VariableViewerService.ServerChannel, response);
            catch ME
                errorResponse.type = "Error";
                errorResponse.varName = string(msg.varName);
                errorResponse.requestType = string(msg.type);
                errorResponse.message = string(ME.message);
                matlabls.internal.CommunicationManager.publish( ...
                    matlabls.variableviewer.VariableViewerService.ServerChannel, errorResponse);
            end
        end
    end

    methods (Static, Access = private)
        function response = buildResponse (response, varName)
            response.type = "VariableResponse";
            response.varName = string(varName);

            % Normalize metadata.size to always serialize as an array
            response.metadata.size = num2cell(response.metadata.size);

            % Normalize labels to always serialize as arrays
            if isfield(response, 'columns') && isfield(response.columns, 'labels')
                response.columns.labels = matlabls.variableviewer.VariableViewerService.ensureCellArray(response.columns.labels);
            end
            if isfield(response, 'rows') && isfield(response.rows, 'labels')
                response.rows.labels = matlabls.variableviewer.VariableViewerService.ensureCellArray(response.rows.labels);
            end

            % Normalize cells.data to always serialize as nested array
            if isfield(response, 'cells') && isfield(response.cells, 'data')
                response.cells.data = matlabls.variableviewer.VariableViewerService.ensureNestedCellArray(response.cells.data);
            end
        end

        function out = ensureCellArray (structArray)
            % Wrap struct array in a cell array so single-element arrays serialize as [{}] not {}
            if isstruct(structArray)
                out = num2cell(structArray);
            else
                out = structArray;
            end
        end

        function out = ensureNestedCellArray (data)
            % Ensure string matrix serializes as [["a","b"],["c","d"]] not ["a","b"]
            if isstring(data)
                nRows = size(data, 1);
                out = cell(nRows, 1);
                for r = 1:nRows
                    out{r} = cellstr(data(r, :));
                end
            else
                out = data;
            end
        end
    end
end
