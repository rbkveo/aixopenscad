// Grid Pattern
// 2D array of objects

$fn = 30;
rows = 5;
cols = 5;
spacing = 10;

for(x = [0:cols-1]) {
    for(y = [0:rows-1]) {
        translate([x*spacing, y*spacing, 0])
            cylinder(h=5, r=2);
    }
}
