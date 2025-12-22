// Countersunk Hole Example
// Hole with angled top for flat-head screws

eps = 0.01;
$fn = 50;

difference() {
    cube([20, 20, 10], center=true);
    
    // Main hole (shaft)
    translate([0, 0, -eps])
        cylinder(h=10+2*eps, r=2);
    
    // Countersink (cone for screw head)
    translate([0, 0, 5-eps])
        cylinder(h=3, r1=2, r2=4);
}
