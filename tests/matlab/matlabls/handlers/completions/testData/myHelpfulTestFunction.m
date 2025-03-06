function out = myHelpfulTestFunction (in1, in2, in3)
    % MYHELPFULTTESTFUNCTION Adds two input values together.

    % Calculate the sum of the two inputs
    out = in1 + in2;

    if (nargin > 2)
        out = out + in3;
    end
end