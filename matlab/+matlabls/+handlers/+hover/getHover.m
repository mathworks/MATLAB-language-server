function hoverText = getHover(topic)
    % GETHOVER Retrieves hover documentation for a given topic or symbol.
    %
    % Copyright 2026 The MathWorks, Inc.

    try
        hoverText = help(topic);
    catch
        hoverText = '';
    end
end
