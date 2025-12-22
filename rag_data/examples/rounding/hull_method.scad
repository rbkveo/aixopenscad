// Rounded Box using Hull Method
// Creates box with rounded vertical edges

$fn = 30;
r = 2;  // Corner radius
width = 20;
height = 20;
depth = 10;

hull() {
    // Place cylinders at each corner
    translate([r, r, 0])
        cylinder(r=r, h=depth);
    translate([width-r, r, 0])
        cylinder(r=r, h=depth);
    translate([r, height-r, 0])
        cylinder(r=r, h=depth);
    translate([width-r, height-r, 0])
        cylinder(r=r, h=depth);
}
