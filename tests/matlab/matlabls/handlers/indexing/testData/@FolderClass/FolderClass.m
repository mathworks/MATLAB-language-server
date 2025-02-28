classdef FolderClass < handle
    properties
        Prop1
        Prop2
    end

    methods
        function obj = FolderClass (in1, in2)
            obj.Prop1 = in1;
            obj.Prop2 = in2;
        end
    end
end
