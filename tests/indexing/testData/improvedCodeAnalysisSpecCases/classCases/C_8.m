classdef C_8
    methods
        function obj = C_8(val)
            fun(obj);
            obj.fun();

            fun(val); % not a reference
        end

        function fun(obj, otherVal)
            fun(obj);
            obj.staticMethod();

            % not references
            otherVal.fun();
            staticMethod(obj);
        end
    end

    methods (Static)
        function staticMethod(val)
            fun(val); % not a reference
        end
    end
end
