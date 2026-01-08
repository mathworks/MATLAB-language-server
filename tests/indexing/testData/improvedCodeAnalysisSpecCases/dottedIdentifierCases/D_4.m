classdef D_4
    methods
        function out = myMethod(obj, val)
            disp(obj.staticMethod(1));
            disp(D_4.staticMethod(1));

            disp(staticMethod(1));
            disp(staticMethod(obj, 1));
            disp(staticMethod(D_4, 1));
            disp(out.staticMethod(1));
            disp(val.myMethod(1));
        end
    end
    methods (Static)
        function staticMethod(val)
        end
    end
end

function local()
    D_4.staticMethod(1);
end
