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

            // Inject BOSL2 library
            await this.injectBOSL2();

            this.ready = true;
            this.isDirty = false;
            console.log('OpenSCAD WASM initialized successfully');
        } catch (error) {
            console.error('Failed to initialize OpenSCAD WASM:', error);
            throw error;
        }
    }

    /**
     * Injects the BOSL2 library into the WASM virtual file system.
     * Fetches the file list from public/bosl2_files.json and loads each file.
     */
    async injectBOSL2() {
        if (!this.instance) throw new Error("WASM instance not ready");

        console.log("Starting BOSL2 injection...");
        const FS = this.instance.FS;

        try {
            // 1. Fetch file list
            const response = await fetch('/bosl2_files.json');
            if (!response.ok) {
                console.warn("Could not load bosl2_files.json. BOSL2 will not be available.");
                return;
            }
            const fileList = await response.json();
            console.log(`Found ${fileList.length} BOSL2 files to inject.`);

            // 2. Ensure /libraries/BOSL2 directory exists
            // We use /libraries/BOSL2 to mimic standard library path structure or just /BOSL2
            // The user requested /BOSL2 in the prompt example, but let's see.
            // "OpenSCAD will look for libraries in the OPENSCADPATH environment variable."
            // Let's adhere to the prompt's recommendation of /BOSL2 for simplicity.

            if (!FS.analyzePath('/BOSL2').exists) {
                FS.mkdir('/BOSL2');
            }

            // 3. Load files
            const baseUrl = '/libraries/BOSL2/';

            const loadPromises = fileList.map(async (filePath) => {
                try {
                    // Create subdirectories if needed
                    const parts = filePath.split('/');
                    if (parts.length > 1) {
                        let currentPath = '/BOSL2';
                        for (let i = 0; i < parts.length - 1; i++) {
                            currentPath += '/' + parts[i];
                            if (!FS.analyzePath(currentPath).exists) {
                                FS.mkdir(currentPath);
                            }
                        }
                    }

                    const response = await fetch(`${baseUrl}${filePath}`);
                    if (!response.ok) throw new Error(`Failed to fetch ${filePath}`);
                    const content = await response.text();

                    FS.writeFile(`/BOSL2/${filePath}`, content);
                } catch (err) {
                    console.warn(`Failed to inject BOSL2 file: ${filePath}`, err);
                }
            });

            await Promise.all(loadPromises);
            console.log("BOSL2 injection complete.");

            // 4. Set OPENSCADPATH
            // If we put files in /BOSL2, and we want `include <BOSL2/std.scad>` to work:
            // If OPENSCADPATH is /, then include <BOSL2/std.scad> looks for /BOSL2/std.scad. Correct.
            // this.instance.setenv("OPENSCADPATH", "/");

        } catch (e) {
            console.error("Error injecting BOSL2:", e);
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

        // 2D/3D Mixing (from OpenSCAD warnings)
        if (errorLog.includes('Scaling a 2D object with 0') || errorLog.includes('Empty extrusion')) {
            return 'DIMENSIONALITY_MIXING';
        }

        return 'GENERAL_ERROR';
    }
}

export const openSCADService = new OpenSCADService();

