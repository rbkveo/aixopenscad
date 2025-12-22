import { createOpenSCAD } from 'openscad-wasm';
import { geometryValidator } from './GeometryValidator';

class OpenSCADService {
    constructor() {
        this.instance = null;
        this.ready = false;
        this.isDirty = false;
        this.lastLogs = [];
    }

    async init() {
        // If already ready and not dirty, skip
        if (this.ready && !this.isDirty) return;

        try {
            console.log('Initializing OpenSCAD WASM instance...');
            this.lastLogs = []; // Reset logs
            const wrapper = await createOpenSCAD({
                noInitialRun: true,
                print: (text) => {
                    console.log('OpenSCAD stdout:', text);
                },
                printErr: (text) => {
                    console.error('OpenSCAD stderr:', text);
                    this.lastLogs.push(text);
                },
            });

            this.instance = wrapper.getInstance();
            this.ready = true;
            this.isDirty = false;
            console.log('OpenSCAD WASM initialized successfully');
        } catch (error) {
            console.error('Failed to initialize OpenSCAD WASM:', error);
            throw error;
        }
    }

    async compile(scadCode) {
        this.lastLogs = []; // Reset logs for this run

        if (!this.ready || this.isDirty) {
            await this.init();
        }

        // Pre-compilation validation
        const validation = geometryValidator.validate(scadCode);
        if (!validation.valid) {
            console.warn('Geometry validation failed:', validation.errors);
            // Return validation errors but still attempt compilation
            // This allows the AI to learn from actual CGAL errors
        }
        if (validation.warnings.length > 0) {
            console.warn('Geometry validation warnings:', validation.warnings);
        }

        const inputFilename = '/input.scad';
        const outputFilename = '/output.stl';

        try {
            this.instance.FS.writeFile(inputFilename, scadCode);

            const args = [inputFilename, '-o', outputFilename];
            console.log('Running OpenSCAD with args:', args);

            try {
                this.instance.callMain(args);
            } catch (e) {
                // Emscripten throws ExitStatus when main() finishes with exit()
                if (e && e.name === 'ExitStatus') {
                    if (e.status !== 0) {
                        const errorMsg = this.lastLogs.join('\n');
                        console.error('OpenSCAD exited with non-zero status:', e.status);

                        // Categorize the error
                        const errorType = this.categorizeError(errorMsg);

                        return {
                            error: errorMsg || 'Unknown compilation error',
                            errorType,
                            status: e.status,
                            logs: errorMsg,
                            validationWarnings: validation.warnings
                        };
                    }
                    console.log('OpenSCAD exited successfully');
                } else {
                    return {
                        error: e.message || 'WASM Execution Error',
                        logs: this.lastLogs.join('\n')
                    };
                }
            }

            const stlData = this.instance.FS.readFile(outputFilename);

            // Mark as dirty so we get a fresh instance next time
            this.isDirty = true;

            return {
                stlData,
                logs: this.lastLogs.join('\n'),
                validationWarnings: validation.warnings
            };
        } catch (error) {
            this.isDirty = true;
            console.error('OpenSCAD compilation error:', error);
            const errorType = this.categorizeError(this.lastLogs.join('\n'));
            return {
                error: error.message || 'General Compilation Failure',
                errorType,
                logs: this.lastLogs.join('\n'),
                validationWarnings: validation?.warnings || []
            };
        }
    }

    /**
     * Categorize OpenSCAD/CGAL errors for better error handling
     */
    categorizeError(errorLog) {
        if (!errorLog) return 'UNKNOWN';

        // CGAL assertion violations
        if (errorLog.includes('CGAL error: assertion violation') ||
            errorLog.includes('e_below != SHalfedge_handle()')) {
            return 'CGAL_ASSERTION_VIOLATION';
        }

        // Empty geometry
        if (errorLog.includes('Current top level object is empty')) {
            return 'EMPTY_GEOMETRY';
        }

        // Non-manifold geometry
        if (errorLog.includes('non-manifold') || errorLog.includes('Non-manifold')) {
            return 'NON_MANIFOLD';
        }

        // Syntax errors
        if (errorLog.includes('syntax error') || errorLog.includes('Parse error')) {
            return 'SYNTAX_ERROR';
        }

        // Undefined variables
        if (errorLog.includes('undefined variable') || errorLog.includes('unknown variable')) {
            return 'UNDEFINED_VARIABLE';
        }

        // File not found (includes)
        if (errorLog.includes("Can't open include file") || errorLog.includes('No such file')) {
            return 'FILE_NOT_FOUND';
        }

        return 'GENERAL_ERROR';
    }
}

export const openSCADService = new OpenSCADService();

