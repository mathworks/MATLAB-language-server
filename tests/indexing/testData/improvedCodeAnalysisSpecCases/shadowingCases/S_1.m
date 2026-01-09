A();

function A()
end

function func()
    disp(A); % refers to variable
    A = 5;
    disp(A);
end
