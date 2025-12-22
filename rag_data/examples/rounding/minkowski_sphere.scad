// Rounded Corners using Minkowski + Sphere
// Best method for uniform rounding of all edges

$fn = 30;
r = 2;  // Rounding radius

minkowski() {
    // Original shape (reduced by 2*r in each dimension)
    cube([16, 16, 6], center=true);
    
    // Rounding sphere
    sphere(r=r);
}

// Result: 20x20x10 cube with all edges rounded
// Final size = original + 2*r in each dimension
