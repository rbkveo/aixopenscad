# OpenSCAD Quick Reference

## Essential Syntax

### Variables
```openscad
eps = 0.01;      // Epsilon for boolean ops
$fn = 50;        // Facet number for curves
width = 20;      // Custom variables
```

### 3D Primitives
```openscad
cube([x, y, z], center=true|false);
sphere(r=radius, d=diameter, $fn=50);
cylinder(h=height, r=radius, d=diameter, r1, r2, $fn=50);
```

### Transformations
```openscad
translate([x, y, z]) object;
rotate([x, y, z]) object;      // Degrees
scale([x, y, z]) object;
mirror([x, y, z]) object;
```

### Boolean Operations
```openscad
union() { obj1; obj2; }
difference() { obj1; obj2; }   // obj1 - obj2
intersection() { obj1; obj2; }
```

### Advanced Operations
```openscad
minkowski() { obj1; obj2; }    // Rounded edges
hull() { obj1; obj2; }         // Convex hull
```

### Control Flow
```openscad
for(i = [start:end]) { }
for(i = [start:step:end]) { }
if(condition) { } else { }
```

### Modules
```openscad
module name(param1, param2) {
    // code
}

name(value1, value2);  // Call
```

## Common Patterns

### Through Hole
```openscad
eps = 0.01; $fn = 50;
difference() {
    cube([20, 20, 10], center=true);
    translate([0, 0, -eps])
        cylinder(h=10+2*eps, r=2);
}
```

### Rounded Corners
```openscad
$fn = 30;
minkowski() {
    cube([16, 16, 6], center=true);
    sphere(r=2);
}
```

### Linear Pattern
```openscad
for(i = [0:4]) {
    translate([i*10, 0, 0])
        cylinder(h=5, r=2);
}
```

### Circular Pattern
```openscad
for(i = [0:7]) {
    rotate([0, 0, i*45])
        translate([15, 0, 0])
            cube([2, 2, 5]);
}
```

## CGAL-Safe Checklist

✓ Define `eps = 0.01` at top
✓ In `difference()`, extend by `2*eps`
✓ Specify `$fn` for all curves
✓ Keep boolean nesting ≤ 3 levels
✓ No coincident faces
✓ Dimensions between 0.1 and 1000
