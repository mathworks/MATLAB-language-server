classdef C_7
    properties (Constant)
        ConstantProperty = 5
    end

    methods
        function obj = C_7()
        end
    end

    methods (Static)
        function staticMethod()
        end
    end
end

function local()
    C_7();
    C_7();
    C_7.ConstantProperty;
    C_7.staticMethod();
end
