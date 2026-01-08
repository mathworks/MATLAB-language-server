classdef D_3
    methods
        function obj = D_3(val)
            disp(obj.myMethod(1));

            disp(val.myMethod(1));
        end
        function out = myMethod(obj, val)
            disp(obj.myMethod(1));
            disp(myMethod(obj, 1));

            disp(out.myMethod(1));
            disp(myMethod(out, 1));
            disp(val.myMethod(1));
            disp(D_3.myMethod(1));
        end
    end
    methods (Static)
        function staticMethod(val)
            disp(val.myMethod(1));
        end
    end
end

function local()
    obj = D_3();
    disp(obj.myMethod(1));
end
