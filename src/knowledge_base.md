# OpenSCAD Knowledge Base

## 1. Syntax & General Concepts
OpenSCAD is a functional, declarative language for 3D modeling.
- **Statements:** End with a semicolon (`;`).
- **Operators:** (Transformations) precede the object and use braces `{}` for multiple children.
- **Comments:** `// single line` or `/* multi-line */`.
- **Data Types:** Numbers (64-bit float), Booleans (`true`/`false`), Strings, Ranges (`[start:end]` or `[start:step:end]`), Vectors (`[1,2,3]`), and Objects (`{key: value}`).
- **Variables:** Constants that cannot be changed once set in a scope. If redefined, only the last assignment is used.
- **Special Variables:** Start with `$`, like `$fn`, `$fa`, `$fs` for resolution control.

## 2. 3D Primitives
- **cube(size, center):** `cube([x,y,z])` or `cube(s)`.
- **sphere(r|d):** `sphere(r=radius)`.
- **cylinder(h, r|d, r1, r2, center):** For cylinders and cones.
- **polyhedron(points, faces):** Most general 3D primitive. Faces must be defined in clockwise order when viewed from the outside.

## 3. 2D Primitives
- **square(size, center):** `square([x,y])`.
- **circle(r|d):** `circle(10)`.
- **polygon(points, paths):** Arbitrary 2D shapes, can include holes.
- **text(text, size, font, halign, valign, spacing, direction):** Generates 2D text geometry.

## 4. Transformations
- **translate([x,y,z]):** Moves objects.
- **rotate([x,y,z]):** Rotates in degrees (Order: X, then Y, then Z).
- **scale([x,y,z]):** Multiplies dimensions.
- **mirror([x,y,z]):** Mirrored across the normal vector.
- **multmatrix(m):** Affine transformation matrix (4x3 or 4x4).
- **resize([x,y,z]):** Modifies child to specified size.
- **color("name"|[r,g,b,a]):** Changes preview color.

## 5. Boolean Operations
- **union():** Sum of objects (implicit if omitted).
- **difference():** Subtracts subsequent children from the first.
- **intersection():** Keeps only overlapping volume.

## 6. Advanced Operations & Modifiers
- **linear_extrude(height, twist, scale, slices):** Extrudes 2D to 3D.
- **rotate_extrude(angle, convexity):** Spins 2D around Z-axis.
- **hull():** Convex hull of child nodes.
- **minkowski():** Minkowski sum of child nodes (useful for rounding edges).
- **offset(r|delta, chamfer):** Offsets 2D outlines.
- **Modifier Characters:** 
  - `*` Disable child.
  - `!` Show only child.
  - `#` Highlight child (debug).
  - `%` Transparent (for alignment).

## 7. Flow Control & User-Defined
- **for(i = [range]):** Evaluates children for each value.
- **intersection_for(i = [range]):** Intersects results of each pass.
- **if(test) { ... } else { ... }:** Conditional logic.
- **let(v1=val, ...):** Sequential variable assignment within a subtree.
- **module name(...) { ... }:** User-defined reusable components.
- **function name(...) = ...:** User-defined mathematical functions.

## 8. External Libraries
- **include <file.scad>:** Imports code as if it were in the main file.
- **use <file.scad>:** Imports modules/functions only (no top-level geometry).
- **import("file.stl"|"file.dxf"):** Loads external geometry.

## Important Syntax Notes
- **Manifoldness:** Objects must be "water-tight" for successful rendering (F6) and STL export. Shared edges or faces without overlap in `difference()` or `union()` often lead to non-manifold errors. Use a small `epsilon = 0.01` to ensure overlap.
- **Epsilon Overlap:** Always use `translate([0,0,-epsilon]) cylinder(h + 2*epsilon, ...)` when subtracting to avoid "Z-fighting" or non-manifold faces.
