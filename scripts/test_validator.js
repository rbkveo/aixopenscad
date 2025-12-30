import { geometryValidator } from '../src/services/GeometryValidator.js';

const testCases = [
    {
        name: 'Valid code',
        code: 'cube([10, 10, 10]);'
    },
    {
        name: 'Dimensionality mixing (2D + 3D)',
        code: 'cube([10, 10, 10]); circle(r=5);'
    },
    {
        name: 'Empty extrusion',
        code: 'linear_extrude(height=10) { ; }'
    },
    {
        name: 'Deep nesting',
        code: 'difference() { union() { difference() { union() { cube(); } } } }'
    },
    {
        name: 'Missing epsilon in difference',
        code: 'difference() { cube(10); translate([0,0,10]) cube(10); }'
    }
];

console.log('--- Starting GeometryValidator Tests ---\n');

testCases.forEach(tc => {
    console.log(`Testing: ${tc.name}`);
    try {
        const result = geometryValidator.validate(tc.code);
        console.log(`Result: ${result.valid ? 'VALID' : 'INVALID'}`);
        if (result.warnings.length > 0) {
            console.log(`Warnings: ${result.warnings.map(w => w.type).join(', ')}`);
        }
        if (result.errors.length > 0) {
            console.log(`Errors: ${result.errors.map(e => e.type).join(', ')}`);
        }
    } catch (error) {
        console.error(`CRASH: ${error.message}`);
        console.error(error.stack);
    }
    console.log('-------------------\n');
});
