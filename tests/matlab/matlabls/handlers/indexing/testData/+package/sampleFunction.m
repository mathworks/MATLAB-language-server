function [out1, out2] = sampleFunction (in1, in2, in3)
    out1 = localFunction(in1, in2);
    out2 = nestedFunction(in3);

    function outNested = nestedFunction (inNested)
        global globalVar
        outNested = abs(inNested);
    end
end

function outLocal =...
        localFunction (in1Local, in2Local)
    outLocal = sum(in1Local, in2Local);
end