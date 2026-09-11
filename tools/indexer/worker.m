function worker(chunkFile, outFile, workerId)
    % WORKER Indexer worker process for MATLAB Language Server
    % Reads a chunk of function names, queries help(), and writes JSONL.
    
    try
        raw = fileread(chunkFile);
        names = jsondecode(raw);
        if ischar(names)
            names = {names};
        elseif iscell(names)
            % cell array is good
        else
            names = cellstr(names);
        end

        fid = fopen(outFile, 'w', 'native', 'UTF-8');
        if fid == -1
            fprintf(2, 'ERROR: Unable to open output file: %s\n', outFile);
            return;
        end
        cleanupObj = onCleanup(@() fclose(fid));

        total = numel(names);
        for i = 1:total
            fn = strtrim(names{i});
            if isempty(fn)
                continue;
            end

            try
                helpText = help(fn);
            catch
                helpText = '';
            end

            if ~isempty(helpText)
                record = struct('name', fn, 'doc', helpText);
                fprintf(fid, '%s\n', jsonencode(record));
            end

            fprintf(1, 'PROG:%d:%s\n', workerId, fn);
        end
    catch ME
        fprintf(2, 'Worker %d failed: %s\n', workerId, ME.message);
    end
end
