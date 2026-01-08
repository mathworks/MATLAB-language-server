classdef D_1
    properties (Constant)
        ConstantProperty
    end
    methods (Static)
        function staticMethod()
            disp(D_1.ConstantProperty);
        end
    end
    enumeration
        A, B, C
    end
end

function local()
    disp(D_1.ConstantProperty);
    disp(D_1.staticMethod());
    disp(D_1.A);
    disp(D_1);
end
