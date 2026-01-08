classdef C_2 < OtherClass
    methods
        function newObj = OtherClass(obj)
            newObj = OtherClass();
        end
    end
end

function local()
    OtherClass.ConstantProperty;
    OtherClass.staticMethod();
end
