# OpenSCAD Techniques - Comprehensive Guide

This guide covers essential vanilla OpenSCAD techniques for creating practical 3D models.

---

## 1. HOLES

### Through Holes

**Description:** A hole that goes completely through an object.

**When to Use:**
- Mounting holes for screws/bolts
- Ventilation holes
- Cable pass-throughs

**Basic Example:**
```openscad
eps = 0.01;
$fn = 50;

difference() {
    cube([20, 20, 10], center=true);
    translate([0, 0, -eps])
        cylinder(h=10+2*eps, r=2);
}
```

**CGAL-Safe Checklist:**
- ✓ eps = 0.01 defined
- ✓ Cylinder extends by 2*eps beyond cube
- ✓ $fn specified for smooth holes
- ✓ No coincident faces

---

### Blind Holes

**Description:** A hole that doesn't go all the way through.

**When to Use:**
- Threaded inserts
- Recessed features
- Partial depth holes

**Example:**
```openscad
eps = 0.01;
$fn = 50;

difference() {
    cube([20, 20, 10], center=true);
    translate([0, 0, 5-eps])  // Start from top
        cylinder(h=6, r=2);    // Only 6mm deep
}
```

---

### Countersunk Holes

**Description:** Hole with angled top for flat-head screws.

**Example:**
```openscad
eps = 0.01;
$fn = 50;

difference() {
    cube([20, 20, 10], center=true);
    
    // Main hole
    translate([0, 0, -eps])
        cylinder(h=10+2*eps, r=2);
    
    // Countersink (cone)
    translate([0, 0, 5-eps])
        cylinder(h=3, r1=2, r2=4);
}
```

---

### Hole Patterns

**Linear Pattern:**
```openscad
eps = 0.01;
$fn = 50;

difference() {
    cube([50, 20, 5], center=true);
    
    // 5 holes in a row
    for(i = [-2:2]) {
        translate([i*10, 0, -eps])
            cylinder(h=5+2*eps, r=2);
    }
}
```

**Circular Pattern:**
```openscad
eps = 0.01;
$fn = 50;

difference() {
    cylinder(h=5, r=20, center=true);
    
    // 8 holes in a circle
    for(i = [0:7]) {
        rotate([0, 0, i*45])
            translate([15, 0, -eps])
                cylinder(h=5+2*eps, r=2);
    }
}
```

---

## 2. ROUNDED CORNERS

### Minkowski with Sphere

**Description:** Best method for uniform rounding of all edges.

**When to Use:**
- Rounded corners on boxes
- Smooth edges
- Organic shapes

**Example:**
```openscad
$fn = 30;
r = 2;  // Rounding radius

minkowski() {
    cube([20, 20, 10], center=true);
    sphere(r=r);
}
// Result: 24x24x14 cube with rounded edges
```

**Important:** Final size = original + 2*r in each dimension

---

### Minkowski with Cylinder

**Description:** Rounds only top/bottom edges, keeps vertical edges sharp.

**Example:**
```openscad
$fn = 30;
r = 2;

minkowski() {
    cube([20, 20, 10], center=true);
    cylinder(r=r, h=0.01);
}
// Vertical edges stay sharp
```

---

### Hull Method

**Description:** Creates smooth transitions between objects.

**When to Use:**
- Organic shapes
- Smooth connections
- Filleted edges

**Example:**
```openscad
$fn = 50;

hull() {
    translate([-10, 0, 0]) sphere(r=5);
    translate([10, 0, 0]) sphere(r=5);
}
// Creates smooth capsule shape
```

**Rounded Box with Hull:**
```openscad
$fn = 30;
r = 2;

hull() {
    translate([-8, -8, 0]) cylinder(r=r, h=10);
    translate([8, -8, 0]) cylinder(r=r, h=10);
    translate([-8, 8, 0]) cylinder(r=r, h=10);
    translate([8, 8, 0]) cylinder(r=r, h=10);
}
```

---

## 3. FILLETS

### Edge Fillet

**Description:** Rounded edge using difference with cylinder.

**Example:**
```openscad
eps = 0.01;
$fn = 50;

difference() {
    cube([20, 20, 10]);
    
    // Fillet on one edge
    translate([0, 0, 10])
        rotate([0, 90, 0])
            cylinder(h=20, r=2);
}
```

### Corner Fillet

**Description:** Rounded corner using difference with sphere.

**Example:**
```openscad
eps = 0.01;
$fn = 50;

difference() {
    cube([20, 20, 10]);
    
    // Fillet on corner
    translate([0, 0, 10])
        sphere(r=3);
}
```

---

## 4. CHAMFERS

### Edge Chamfer

**Description:** Angled edge cut.

**Example:**
```openscad
eps = 0.01;

difference() {
    cube([20, 20, 10]);
    
    // 45-degree chamfer
    translate([-eps, -eps, 10])
        rotate([0, 45, 0])
            cube([3, 22, 3]);
}
```

### Corner Chamfer

**Description:** Cut corner at angle.

**Example:**
```openscad
eps = 0.01;

difference() {
    cube([20, 20, 10]);
    
    // Corner chamfer
    translate([20, 20, 10])
        rotate([0, 0, 45])
            cube([5, 5, 5], center=true);
}
```

---

## 5. PATTERNS

### Linear Array

**Description:** Repeat objects in a line.

**Example:**
```openscad
$fn = 30;

for(i = [0:4]) {
    translate([i*15, 0, 0])
        cylinder(h=10, r=3);
}
```

### Grid Pattern

**Description:** 2D array of objects.

**Example:**
```openscad
$fn = 30;

for(x = [0:4]) {
    for(y = [0:4]) {
        translate([x*10, y*10, 0])
            cylinder(h=5, r=2);
    }
}
```

### Circular Pattern

**Description:** Objects arranged in a circle.

**Example:**
```openscad
$fn = 30;
count = 12;

for(i = [0:count-1]) {
    rotate([0, 0, i*(360/count)])
        translate([20, 0, 0])
            cube([3, 3, 10], center=true);
}
```

---

## 6. ADVANCED BOOLEAN OPERATIONS

### Multiple Differences

**Example:**
```openscad
eps = 0.01;
$fn = 50;

difference() {
    cube([30, 30, 10], center=true);
    
    // Multiple holes
    translate([-8, -8, -eps]) cylinder(h=10+2*eps, r=2);
    translate([8, -8, -eps]) cylinder(h=10+2*eps, r=2);
    translate([-8, 8, -eps]) cylinder(h=10+2*eps, r=2);
    translate([8, 8, -eps]) cylinder(h=10+2*eps, r=2);
}
```

### Intersection

**Description:** Keep only overlapping parts.

**Example:**
```openscad
$fn = 50;

intersection() {
    cube([20, 20, 20], center=true);
    sphere(r=12);
}
// Creates rounded cube
```

---

## 7. MODULES FOR REUSABILITY

### Parametric Hole Module

```openscad
eps = 0.01;
$fn = 50;

module through_hole(diameter, height) {
    translate([0, 0, -eps])
        cylinder(h=height+2*eps, d=diameter);
}

module countersunk_hole(diameter, height, sink_diameter, sink_depth) {
    through_hole(diameter, height);
    translate([0, 0, height-sink_depth])
        cylinder(h=sink_depth+eps, d1=diameter, d2=sink_diameter);
}

// Usage
difference() {
    cube([30, 30, 10], center=true);
    translate([0, 0, 5]) countersunk_hole(4, 10, 8, 3);
}
```

### Rounded Box Module

```openscad
$fn = 30;

module rounded_box(size, radius) {
    minkowski() {
        cube([size[0]-2*radius, size[1]-2*radius, size[2]-2*radius], center=true);
        sphere(r=radius);
    }
}

// Usage
rounded_box([20, 20, 10], 2);
```

---

## COMMON PITFALLS

### ❌ Missing Epsilon
```openscad
// WRONG - causes CGAL errors
difference() {
    cube(10);
    cylinder(h=10, r=2);
}
```

### ✓ Correct Epsilon Usage
```openscad
// CORRECT
eps = 0.01;
difference() {
    cube(10);
    translate([0, 0, -eps])
        cylinder(h=10+2*eps, r=2);
}
```

### ❌ Forgetting $fn
```openscad
// WRONG - faceted circles
cylinder(h=10, r=5);
```

### ✓ Smooth Circles
```openscad
// CORRECT
$fn = 50;
cylinder(h=10, r=5);
```

### ❌ Coincident Faces
```openscad
// WRONG - faces at exact same position
difference() {
    cube(10);
    translate([0, 0, 5])
        cube([10, 10, 5]);
}
```

### ✓ Proper Overlap
```openscad
// CORRECT
eps = 0.01;
difference() {
    cube(10);
    translate([0, 0, 5-eps])
        cube([10, 10, 5+eps]);
}
```

---

## BEST PRACTICES

1. **Always define epsilon:** `eps = 0.01;`
2. **Always specify $fn:** `$fn = 50;` for production quality
3. **Use modules:** Encapsulate reusable patterns
4. **Keep nesting shallow:** Max 3 levels of boolean operations
5. **Comment your code:** Explain non-obvious geometry
6. **Test incrementally:** Build complex shapes step by step
7. **Use meaningful names:** `mounting_hole()` not `h1()`
