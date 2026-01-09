function range = makeRange (lineStart, charStart, lineEnd, charEnd)
    % Creates a matrix representing a range with line and character positions.
    % This is structured as [lineStart, charStart, lineEnd, charEnd].
    %
    % This does not create a struct in LSP format to boost performance - It
    % is significantly faster to create a matrix than a struct, especially
    % when called for many ranges within the document.

    % Copyright 2025 The MathWorks, Inc.

    range = [lineStart, charStart, lineEnd, charEnd];
end
