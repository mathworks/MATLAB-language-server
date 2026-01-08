disp('Plotting Data')

%% Create Data
x = linspace(-5, 5, 10000);
y = sin(x);

%% Plot
plot(x, y)

%% Additional Variable Definitions
global a;

for i = 1:5
    global b;
    
    parfor j = 1:5
    end
end