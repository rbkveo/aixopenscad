// Linear Pattern of Cylinders
// Repeat objects in a line using for loop

$fn = 30;
count = 5;
spacing = 15;

for(i = [0:count-1]) {
    translate([i*spacing, 0, 0])
        cylinder(h=10, r=3);
}
