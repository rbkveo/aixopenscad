/**
 * GeometryValidator - Pre-compilation validation for OpenSCAD code
 * Detects common CGAL issues before compilation to prevent errors
 */
class GeometryValidator {
    constructor() {
        this.validationRules = {
            epsilon: {
                pattern: /difference\s*\(\s*\)/,
                check: (code) => this.checkEpsilonUsage(code)
            },
            dimensions: {
                check: (code) => this.checkDimensions(code)
            },
            nesting: {
                check: (code) => this.checkBooleanNesting(code)
            },
            dimensionality: {
                check: (code) => this.checkDimensionality(code)
            }
        };
    }

    /**
     * Validate OpenSCAD code for CGAL-safe patterns
     * @param {string} code - OpenSCAD code to validate
     * @returns {Object} - { valid: boolean, warnings: [], errors: [] }
     */
    validate(code) {
        const result = {
            valid: true,
            warnings: [],
            errors: []
        };

        // Check 1: Epsilon definition and usage
        const epsCheck = this.checkEpsilonUsage(code);
        if (!epsCheck.valid) {
            result.errors.push(...epsCheck.errors);
            result.valid = false;
        }
        result.warnings.push(...epsCheck.warnings);

        // Check 2: Dimension validation
        const dimCheck = this.checkDimensions(code);
        result.warnings.push(...dimCheck.warnings);

        // Check 3: Boolean nesting depth
        const nestCheck = this.checkBooleanNesting(code);
        result.warnings.push(...nestCheck.warnings);

        // Check 4: $fn specification
        const fnCheck = this.checkFnSpecification(code);
        result.warnings.push(...fnCheck.warnings);

        // Check 5: 2D/3D Dimensionality mixing
        const dimMixCheck = this.checkDimensionality(code);
        result.warnings.push(...dimMixCheck.warnings);

        return result;
    }

    /**
     * Check epsilon usage in difference operations
     */
    checkEpsilonUsage(code) {
        const result = { valid: true, errors: [], warnings: [] };

        // Check if eps is defined
        const epsDefinition = /eps\s*=\s*[\d.]+\s*;/;
        const hasEpsDefinition = epsDefinition.test(code);

        // Find all difference() operations
        const differencePattern = /difference\s*\(\s*\)\s*\{/g;
        const differences = code.match(differencePattern);

        if (differences && differences.length > 0) {
            if (!hasEpsDefinition) {
                result.errors.push({
                    type: 'MISSING_EPSILON_DEFINITION',
                    message: 'Epsilon (eps) not defined. Add "eps = 0.01;" at the top of your code.',
                    severity: 'error',
                    fix: 'Add this line at the beginning: eps = 0.01;'
                });
                result.valid = false;
            } else {
                // Check if eps is actually used in difference operations
                const epsUsagePattern = /translate\s*\(\s*\[[^\]]*-eps[^\]]*\]\s*\)/;
                const hasEpsUsage = epsUsagePattern.test(code);

                if (!hasEpsUsage) {
                    result.warnings.push({
                        type: 'EPSILON_NOT_USED',
                        message: 'Epsilon defined but not used in difference() operations.',
                        severity: 'warning',
                        fix: 'Use eps in translate() for subtracted objects: translate([x,y,-eps])'
                    });
                }
            }
        }

        return result;
    }

    /**
     * Check for problematic dimensions
     */
    checkDimensions(code) {
        const result = { warnings: [] };

        // Find numeric values in the code
        const numberPattern = /\b(\d+\.?\d*)\b/g;
        const numbers = [];
        let match;

        while ((match = numberPattern.exec(code)) !== null) {
            const num = parseFloat(match[1]);
            if (!isNaN(num)) {
                numbers.push(num);
            }
        }

        // Check for very small dimensions
        const tooSmall = numbers.filter(n => n > 0 && n < 0.01);
        if (tooSmall.length > 0) {
            result.warnings.push({
                type: 'DIMENSION_TOO_SMALL',
                message: `Found ${tooSmall.length} dimension(s) < 0.01. This may cause CGAL precision errors.`,
                severity: 'warning',
                fix: 'Use dimensions >= 0.1 for reliable geometry'
            });
        }

        // Check for very large dimensions
        const tooLarge = numbers.filter(n => n > 10000);
        if (tooLarge.length > 0) {
            result.warnings.push({
                type: 'DIMENSION_TOO_LARGE',
                message: `Found ${tooLarge.length} dimension(s) > 10000. This may cause numerical issues.`,
                severity: 'warning',
                fix: 'Keep dimensions <= 1000 for best results'
            });
        }

        return result;
    }

    /**
     * Check boolean operation nesting depth
     */
    checkBooleanNesting(code) {
        const result = { warnings: [] };

        // Count nesting depth of boolean operations
        const booleanOps = ['difference', 'union', 'intersection'];
        let maxDepth = 0;
        let currentDepth = 0;

        // Simple depth tracking (not perfect but catches most cases)
        const lines = code.split('\n');
        for (const line of lines) {
            for (const op of booleanOps) {
                if (line.includes(`${op}(`)) {
                    currentDepth++;
                    maxDepth = Math.max(maxDepth, currentDepth);
                }
            }
            // Count closing braces
            const closingBraces = (line.match(/\}/g) || []).length;
            currentDepth = Math.max(0, currentDepth - closingBraces);
        }

        if (maxDepth > 3) {
            result.warnings.push({
                type: 'DEEP_BOOLEAN_NESTING',
                message: `Boolean operation nesting depth is ${maxDepth} (recommended: <= 3).`,
                severity: 'warning',
                fix: 'Simplify by breaking into separate modules or using intermediate variables'
            });
        }

        return result;
    }

    /**
     * Check for 2D/3D dimensionality mixing and empty extrusions
     */
    checkDimensionality(code) {
        const result = { warnings: [] };

        // 1. Detect 2D objects that might be mixed into 3D scenes
        // circle, square, polygon, text
        const twoDPrimitives = ['circle', 'square', 'polygon', 'text'];

        // This is a naive check: if we see 2D primitives and 3D primitives (cube, cylinder, sphere, cyl, cuboid)
        // in the same file, warn about potential mixing if no extrusions are present.
        const threeDPrimitives = ['cube', 'cylinder', 'sphere', 'cyl', 'cuboid', 'torus', 'rect_tube', 'tube'];

        const has2D = twoDPrimitives.some(p => new RegExp(`\\b${p}\\s*\\(`).test(code));
        const has3D = threeDPrimitives.some(p => new RegExp(`\\b${p}\\s*\\(`).test(code));
        const hasExtrusion = /\b(linear_extrude|rotate_extrude)\b/.test(code);

        if (has2D && has3D && !hasExtrusion) {
            result.warnings.push({
                type: 'DIMENSIONALITY_MIXING',
                message: 'Detected both 2D and 3D primitives without extrusions. This often causes "Scaling a 2D object with 0" errors.',
                severity: 'warning',
                fix: 'Wrap 2D objects (circle, square, etc.) in linear_extrude() or rotate_extrude()'
            });
        }

        // 2. Detect empty extrusions: linear_extrude(h=...) {};
        const emptyExtrusionPattern = /linear_extrude\s*\([^)]*\)\s*\{\s*;\s*\}/g;
        if (emptyExtrusionPattern.test(code)) {
            result.warnings.push({
                type: 'EMPTY_EXTRUSION',
                message: 'Detected linear_extrude() with no children.',
                severity: 'warning',
                fix: 'Add a 2D object (like circle or square) inside the extrusion braces'
            });
        }

        return result;
    }

    /**
     * Check $fn specification for curves
     */
    checkFnSpecification(code) {
        const result = { warnings: [] };

        // Check for cylinder, sphere without $fn
        const curveOps = ['cylinder', 'sphere'];
        const fnPattern = /\$fn\s*=/;

        for (const op of curveOps) {
            const opPattern = new RegExp(`${op}\\s*\\([^)]*\\)`, 'g');
            const matches = code.match(opPattern);

            if (matches) {
                for (const match of matches) {
                    if (!fnPattern.test(match)) {
                        result.warnings.push({
                            type: 'MISSING_FN',
                            message: `${op}() found without $fn specification. May result in faceted appearance.`,
                            severity: 'info',
                            fix: `Add $fn parameter: ${op}(..., $fn=50)`
                        });
                        break; // Only warn once per operation type
                    }
                }
            }
        }

        return result;
    }

    /**
     * Suggest automatic fixes for common issues
     */
    suggestFixes(code, validationResult) {
        let fixedCode = code;
        const fixes = [];

        // Fix 1: Add epsilon definition if missing
        if (validationResult.errors.some(e => e.type === 'MISSING_EPSILON_DEFINITION')) {
            if (!code.includes('eps =')) {
                fixedCode = 'eps = 0.01;\n\n' + fixedCode;
                fixes.push('Added epsilon definition');
            }
        }

        // Fix 2: Add $fn to global scope if missing
        if (validationResult.warnings.some(w => w.type === 'MISSING_FN')) {
            if (!code.includes('$fn =')) {
                fixedCode = '$fn = 50;\n' + fixedCode;
                fixes.push('Added global $fn specification');
            }
        }

        return { fixedCode, fixes };
    }
}

export const geometryValidator = new GeometryValidator();
