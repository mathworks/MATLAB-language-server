classdef C_6
    properties (Constant)
        ConstantProperty = 5
    end

    methods
        function obj = C_6()
        end
    end

    methods (Static)
        function staticMethod()
        end
    end
end

function local()
    C_6();
    C_6.ConstantProperty;
    C_6.staticMethod();
end
