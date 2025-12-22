// Through Hole Example
// A hole that goes completely through an object

eps = 0.01;
$fn = 50;

difference() {
    // Main body
    cube([20, 20, 10], center=true);
    
    // Through hole
    translate([0, 0, -eps])
        cylinder(h=10+2*eps, r=2);
}
