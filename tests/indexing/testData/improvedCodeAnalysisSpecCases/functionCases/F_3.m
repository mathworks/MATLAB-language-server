function f1()
    f2();
end

f1();

function f2()
    f1();
    f2();
    f3();

    function f3()
        f3();
    end
end
