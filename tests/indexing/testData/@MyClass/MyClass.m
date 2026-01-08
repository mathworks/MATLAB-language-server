classdef MyClass < Base1 & Base2 & Base3
    properties
        Prop
    end

    properties (Constant)
        ConstantProperty = 5
    end

    enumeration
        A, B
    end

    enumeration
        C, D
    end

    methods
        function myMethod(obj)
            disp(obj);
        end
    end

    methods (Static)
        protoOut = staticMethod(protoIn)
    end
end
