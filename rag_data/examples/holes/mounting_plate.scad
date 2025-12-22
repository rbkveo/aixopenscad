// Mounting Plate with 4 Corner Holes
// Common pattern for mounting brackets

eps = 0.01;
$fn = 50;

module mounting_plate(width, height, thickness, hole_diameter, hole_inset) {
    difference() {
        // Main plate
        cube([width, height, thickness], center=true);
        
        // 4 corner holes
        for(x = [-(width/2-hole_inset), (width/2-hole_inset)]) {
            for(y = [-(height/2-hole_inset), (height/2-hole_inset)]) {
                translate([x, y, -eps])
                    cylinder(h=thickness+2*eps, d=hole_diameter);
            }
        }
    }
}

// Example usage
mounting_plate(50, 50, 5, 4, 5);
