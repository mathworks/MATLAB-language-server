classdef C_1
    properties (Constant)
        ConstantProperty = 5
    end

    methods
        function obj = C_1()
        end
    end

    methods (Static)
        function staticMethod()
        end
    end
end

function local()
    C_1();
    C_1.ConstantProperty;
    C_1.staticMethod();
end
