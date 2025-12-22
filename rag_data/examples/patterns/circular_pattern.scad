// Circular Pattern
// Objects arranged in a circle

$fn = 30;
count = 12;
radius = 20;

for(i = [0:count-1]) {
    angle = i * (360/count);
    rotate([0, 0, angle])
        translate([radius, 0, 0])
            cube([3, 3, 10], center=true);
}
