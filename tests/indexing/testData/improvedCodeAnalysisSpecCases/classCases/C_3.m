classdef C_3
    properties
        MyProperty = 4
    end
    properties (Constant)
        ConstantProperty = 5
    end

    methods
        function obj = C_3()
            disp(obj.MyProperty)
            obj.MyProperty = 5;
            disp(obj.ConstantProperty)
            disp(C_3.ConstantProperty)
        end

        function val = get.MyProperty(obj)
        end
        function obj = set.MyProperty(obj, val)
        end
    end
end

function local()
    disp(C_3.ConstantProperty)
end
