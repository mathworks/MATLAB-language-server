classdef SampleClass <...
        SuperA & SuperB
    enumeration
        A (1, 'a')
        B (2, 'b')
        C (3, 'c')
    end

    properties
        PropA
        PropB
    end

    methods
        function obj = SampleClass (a, b)
            obj.PropA = a;
            obj.PropB = b;
        end

        function publicFcn (obj)
        end
    end

    methods (Abstract)
        out = abstractFcn (in)
    end

    methods (Hidden)
        function privateFcn (obj)
            disp(['PropA: ', num2str(obj.PropA)]);
            disp(['PropB: ', obj.PropB]);
        end
    end
end