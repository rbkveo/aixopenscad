import { Ollama } from 'ollama/browser';
import { GoogleGenAI } from '@google/genai';
import { loggingService } from './LoggingService';

/**
 * AIService handles communication with LLMs (Ollama or Gemini).
 */
class AIService {
    constructor() {
        this.reasoningProvider = 'ollama';
        this.reasoningModel = 'devstral-small-2:24b';

        this.visionProvider = 'ollama';
        this.visionModel = 'qwen3-vl:32b';

        // Configuration
        this.config = {
            keepAlive: '1m',
            enableVisualQA: true,
            debugMode: true
        };

        this.ollama = new Ollama({
            host: import.meta.env.VITE_OLLAMA_HOST || '/ollama'
        });

        const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
        this.genAI = new GoogleGenAI({ apiKey });

        this.knowledgeBase = null;
        this.pipelineLogs = [];
    }

    setConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
    }

    setReasoningProvider(provider) {
        this.reasoningProvider = provider;
    }

    setReasoningModel(model) {
        this.reasoningModel = model;
    }

    setVisionProvider(provider) {
        this.visionProvider = provider;
    }

    setVisionModel(model) {
        this.visionModel = model;
    }

    async loadKnowledgeBase() {
        if (this.knowledgeBase) return;
        try {
            // Enhanced Knowledge Base for OpenSCAD - BOSL2 & CGAL-Safe Patterns
            this.knowledgeBase = `
OpenSCAD Syntax & CRITICAL CGAL-Safe Best Practices:

1. SEMICOLONS: Every statement MUST end with a semicolon (e.g., cube(10);).

2. MODULES: Use 'module name(params) { ... }' for reusable components.

3. BOSL2 PREFERENCE (MANDATORY):
   - Use 'include <BOSL2/std.scad>'
   - Use 'cyl()' instead of 'cylinder()'
   - Use 'cuboid()' instead of 'cube()'
   - Use 'torus()' for rings or handles
   - Use 'diff()' for boolean differences with automated placement
   - Use Anchors and 'attach()' for positioning (e.g., 'attach(RIGHT) torus(...)')

4. NO BARE 2D OBJECTS:
   - NEVER use 'circle()', 'square()', or 'polygon()' directly in a 3D scene.
   - 2D objects MUST be wrapped in 'linear_extrude()' or 'rotate_extrude()'.
   - Mixing 2D and 3D in 'difference()' or 'union()' without extrusion causes errors.

5. BOOLEAN OPERATIONS:
   - 'union()', 'difference()', 'intersection()' wrap children in braces {}
   - ALWAYS use epsilon (eps) for difference() if not using BOSL2 'diff()' or tags.
   - Keep boolean nesting depth <= 3 levels.

6. EPSILON RULES (MANDATORY for vanilla OpenSCAD):
   - Define: eps = 0.01; at the top
   - For difference(): subtract object must extend beyond parent by 2*eps

7. DIMENSION CONSTRAINTS:
   - Minimum dimension: 0.1
   - Maximum dimension: 1000

8. BOSL2 TAGS:
   - Use 'tag("remove")' inside 'diff() { ... }' to subtract objects.
   - Example: 'diff() cyl(r=10, h=20) tag("remove") up(5) cyl(r=8, h=21);'

9. COMMON PITFALLS:
   ❌ Mixing 2D (circle) and 3D (cylinder) in difference()
   ❌ Missing epsilon in vanilla difference()
   ❌ Coincident faces
   ❌ Zero-thickness geometry
`;
        } catch (err) {
            console.error("Failed to load knowledge base:", err);
        }
    }

    async getAvailableModels() {
        const models = [];
        try {
            const ollamaList = await this.ollama.list();
            ollamaList.models.forEach(m => {
                models.push({ id: m.name, name: m.name, provider: 'ollama' });
            });
        } catch (err) {
            console.warn("Failed to fetch Ollama models:", err);
        }
        models.push({ id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', provider: 'gemini' });
        models.push({ id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', provider: 'gemini' });
        return models;
    }

    _log(step, data) {
        const entry = {
            timestamp: new Date().toISOString(),
            step,
            ...data
        };
        this.pipelineLogs.push(entry);

        // Use enhanced logging service
        loggingService.log('Pipeline', step, data);

        return entry;
    }

    getLogs() {
        return this.pipelineLogs;
    }

    clearLogs() {
        this.pipelineLogs = [];
    }

    async sendMessage(prompt, context = {}) {
        await this.loadKnowledgeBase();
        const { currentCode, screenshot } = context;

        // RAG Retrieval
        let ragContext = "";
        if (this.config.enableRAG) {
            try {
                const { ragService } = await import('./RAGService');
                const results = await ragService.search(prompt, 12);
                if (results.length > 0) {
                    ragContext = "\n\nRelevant RAG Documentation & Examples:\n" +
                        results.map(r => `[Source: ${r.metadata.source}]\n${r.content}`).join('\n---\n');
                    this._log('RAG Retrieval', { chunks: results.length });
                }
            } catch (e) {
                console.warn("RAG Search failed:", e);
            }
        }

        const systemPrompt = `You are an expert OpenSCAD designer specializing in CGAL-safe geometry and the BOSL2 library.
Return ONLY a JSON object. Do not include markdown formatting outside the JSON.
${this.knowledgeBase}
${ragContext}

CRITICAL CONSTRAINTS - OpenSCAD WASM Environment:
- You are running in a BROWSER environment.
- The BOSL2 library is PRE-LOADED and available.
- You SHOULD use BOSL2 standard library when helpful: include <BOSL2/std.scad>
- Do NOT use other external libraries.

HOW TO USE DOCUMENTATION (if provided above):
- Follow the examples and techniques shown.
- If BOSL2 documentation is provided, USE IT to simplify geometry.
- Apply CGAL-safe practices.

MANDATORY CGAL-SAFE REQUIREMENTS:
1. ALWAYS define epsilon at the top: eps = 0.01;
2. For EVERY difference() operation:
   - Subtract object MUST extend by 2*eps beyond the parent
   - Example: difference() { cube(10); translate([5,5,-eps]) cylinder(h=10+2*eps, r=2); }
3. Dimensions:
   - Make sure dimensions are reasonable.
4. Boolean operations:
   - Keep nesting depth <= 3 levels
   - Avoid coincident faces
   - Use $fn=50 or higher for curves
210. BOSL2 Usage:
   - Prefer BOSL2 modules (cuboid, cyl, torus, etc.) over vanilla primitives.
   - Use 'diff() { ... }' and 'tag("remove")' for cleaner subtractions.
   - Use 'attach()' and Anchors ('BOTTOM', 'TOP', 'RIGHT', etc.) for positioning.
   - NEVER mix 2D primitives (circle, square) with 3D primitives (cyl, cuboid) without extrusion.

Output Schema:
{
  "name": "Model Name",
  "description": "Logic explanation",
  "parameters": [ {"name": "var_name", "value": 10, "desc": "description"} ],
  "openscad_code": "The full code here"
}

VALIDATION CHECKLIST (verify before returning):
✓ eps = 0.01; defined at top
✓ Checked if BOSL2 can simplify the design
✓ All difference() operations use eps correctly
✓ Valid OpenSCAD syntax`;

        const userPrompt = `Current code: ${currentCode || 'None'}\nTask: ${prompt}`;

        this._log('Generation Started', { model: this.reasoningModel });

        try {
            let aiResponse;
            if (this.reasoningProvider === 'gemini') {
                aiResponse = await this._sendGeminiMessage(userPrompt, systemPrompt, screenshot, this.reasoningModel, true);
            } else {
                aiResponse = await this._sendOllamaMessage(this.reasoningModel, userPrompt, systemPrompt, screenshot, true);
            }

            // Syntax Check (Linting)
            if (aiResponse && aiResponse.suggestedCode) {
                const lintResult = await this._lintCode(aiResponse.suggestedCode);
                if (!lintResult.valid) {
                    this._log('Linting Failed', { error: lintResult.error });
                    return await this.fixCode("Linting Error", lintResult.error, { currentCode: aiResponse.suggestedCode });
                }
            }

            return aiResponse;
        } catch (err) {
            this._log('Pipeline Error', { error: err.message });
            return { text: "Error in generation", error: err.message };
        }
    }

    async fixCode(errorCode, logs, context = {}) {
        await this.loadKnowledgeBase();
        const { currentCode, errorType, validationWarnings } = context;

        // Build context about validation warnings
        let validationContext = '';
        if (validationWarnings && validationWarnings.length > 0) {
            validationContext = '\n\nPre-compilation Validation Warnings:\n' +
                validationWarnings.map(w => `- ${w.message}\n  Fix: ${w.fix}`).join('\n');
        }

        // Add specific guidance based on error type
        let errorGuidance = '';
        if (errorType === 'CGAL_ASSERTION_VIOLATION') {
            errorGuidance = '\n\nThis is a CGAL ASSERTION VIOLATION. Focus on:\n' +
                '1. Check epsilon usage in ALL difference() operations\n' +
                '2. Ensure subtracted objects extend by 2*eps beyond parent\n' +
                '3. Verify no coincident faces exist\n' +
                '4. Simplify boolean operations if deeply nested';
        } else if (errorType === 'EMPTY_GEOMETRY') {
            errorGuidance = '\n\nGeometry resulted in EMPTY OBJECT. This means:\n' +
                '1. Boolean operation completely removed all geometry\n' +
                '2. Check if subtracted object is larger than parent\n' +
                '3. Verify object positions and dimensions\n' +
                '4. Consider using union() first to test geometry';
        }

        const systemPrompt = `You are a code debugger for OpenSCAD specializing in CGAL error resolution.
Return ONLY a JSON object. Do not include markdown formatting outside the JSON.

Error Type: ${errorType || 'UNKNOWN'}
Error Logs:
${logs}
${validationContext}
${errorGuidance}

${this.knowledgeBase}

COMMON CGAL ERROR PATTERNS AND FIXES:

1. "CGAL error: assertion violation" or "e_below != SHalfedge_handle()":
   - CAUSE: Missing or insufficient epsilon in difference()
   - FIX: Add eps=0.01 at top, extend subtracted objects by 2*eps
   - Example fix:
     Before: difference() { cube(10); cylinder(h=10, r=2); }
     After:  eps=0.01; difference() { cube(10); translate([0,0,-eps]) cylinder(h=10+2*eps, r=2); }

2. "Current top level object is empty":
   - CAUSE: Boolean operation failed completely
   - FIX: Simplify geometry, reduce nesting, check for coincident faces
   - Try: Break complex difference() into multiple simpler operations

3. Non-manifold geometry:
   - CAUSE: Edges shared by more than 2 faces, or zero-thickness surfaces
   - FIX: Ensure all objects have volume, avoid surface-only geometry
   - Add small thickness to any 2D extrusions

4. Numerical precision errors:
   - CAUSE: Very small dimensions (< 0.01) or very large (> 10000)
   - FIX: Scale dimensions to reasonable range (0.1 to 1000)

Output Schema:
{
  "name": "Fixed Model Name",
  "description": "Explanation of what was wrong and how it was fixed", 
  "parameters": [],
  "openscad_code": "The full FIXED code here"
}

FIXING STRATEGY:
1. If CGAL error: Check epsilon usage first
2. If still failing: Simplify boolean operations
3. If still failing: Reduce nesting depth
4. If still failing: Use alternative approach (minkowski, hull, etc.)

Task: Identify the specific error type and provide the FIXED code with explanation.`;

        const userPrompt = `Compilation failed. Error: ${logs}\nCurrent Code:\n${currentCode}`;

        this._log('Fix Attempt Started', { errorCode, logsSnippet: logs.substring(0, 100) });

        try {
            let aiResponse;
            if (this.reasoningProvider === 'gemini') {
                aiResponse = await this._sendGeminiMessage(userPrompt, systemPrompt, null, this.reasoningModel, true);
            } else {
                aiResponse = await this._sendOllamaMessage(this.reasoningModel, userPrompt, systemPrompt, null, true);
            }

            // Lint the fix too
            if (aiResponse && aiResponse.suggestedCode) {
                const lintResult = await this._lintCode(aiResponse.suggestedCode);
                if (!lintResult.valid) {
                    this._log('Fix Linting Failed', { error: lintResult.error });
                    // No recursive loop here to avoid infinite cycles, just return the raw result
                }
            }

            return aiResponse;
        } catch (err) {
            this._log('Fix Pipeline Error', { error: err.message });
            return { text: "Error in fix attempt", error: err.message };
        }
    }

    /**
     * Rapid syntax check using a small model
     */
    async _lintCode(code) {
        const linterPrompt = `Check this OpenSCAD code for syntax errors (semicolons, unclosed braces, undefined variables).
If it's perfect, return {"valid": true}. 
If there are errors, return {"valid": false, "error": "description of first error found"}.
Return ONLY JSON.

Code:
${code}`;

        try {
            const response = await this.ollama.chat({
                model: 'gemma3:4b',
                messages: [{ role: 'user', content: linterPrompt }],
                format: 'json',
                options: { temperature: 0 }
            });
            const content = response.message.content;
            return JSON.parse(content);
        } catch (e) {
            this._log('Linter Crashed', { error: e.message });
            return { valid: true }; // Fallback
        }
    }

    async analyzeVisuals(screenshot, userIntent, currentCode) {
        if (!this.config.enableVisualQA) return { text: "Visual QA disabled", suggestedCode: null };

        await this.loadKnowledgeBase();
        const systemPrompt = `You are a visual quality assurance expert for 3D modeling.
You are looking at a screenshot of an OpenSCAD model.

User's original intent: ${userIntent}
Current Code:
\`\`\`openscad
${currentCode}
\`\`\`

Task:
1. Does the image match the user's intent?
2. Are there any visible artifacts or mistakes?
3. If it looks correct, say "LOOKS GOOD".
4. If not, describe what is wrong and how to fix it in OpenSCAD code.`;

        const userPrompt = "Analyze this rendered model based on my intent.";

        this._log('Visual Analysis Request', { userIntent, visionModel: this.visionModel });

        if (this.visionProvider === 'gemini') {
            return this._sendGeminiMessage(userPrompt, systemPrompt, screenshot, this.visionModel);
        } else {
            return this._sendOllamaMessage(this.visionModel, userPrompt, systemPrompt, screenshot);
        }
    }

    async _sendGeminiMessage(prompt, systemPrompt, screenshot = null, overrideModel = null, isJson = false) {
        const modelId = overrideModel || this.reasoningModel;
        try {
            const model = this.genAI.getGenerativeModel({
                model: modelId,
                generationConfig: isJson ? { responseMimeType: "application/json" } : undefined
            });

            const contents = [{
                role: 'user',
                parts: [{ text: prompt }]
            }];

            if (screenshot) {
                const imageData = screenshot.split(',')[1] || screenshot;
                contents[0].parts.push({
                    inline_data: {
                        data: imageData,
                        mime_type: "image/png"
                    }
                });
            }

            const response = await model.generateContent({
                systemInstruction: systemPrompt,
                contents: contents
            });

            const content = response.response.text();

            this._log('AI: Raw Response (Gemini)', { model: modelId, rawText: content });

            if (isJson) {
                try {
                    const parsed = JSON.parse(content);
                    return {
                        text: parsed.description || "Generated successfully",
                        suggestedCode: parsed.openscad_code,
                        metadata: { name: parsed.name, parameters: parsed.parameters }
                    };
                } catch {
                    this._log('Gemini JSON Parse Error', { content });
                    return this._parseResponse(content);
                }
            }

            const result = this._parseResponse(content);
            this._log('Gemini Response', { model: modelId, response: result.text });
            return result;
        } catch (err) {
            this._log('Gemini Error', { error: err.message });
            console.error("Gemini Error:", err);
            return { text: `Gemini Error: ${err.message}`, suggestedCode: null };
        }
    }

    async _sendOllamaMessage(modelName, prompt, systemPrompt, screenshot = null, isJson = false) {
        let imageData = null;
        if (screenshot) {
            imageData = screenshot.replace(/^data:image\/(png|jpg|jpeg);base64,/, '');
        }

        const messages = [
            { role: 'system', content: systemPrompt },
            {
                role: 'user',
                content: prompt,
                ...(imageData && { images: [imageData] })
            }
        ];

        try {
            const response = await this.ollama.chat({
                model: modelName,
                messages: messages,
                stream: false,
                format: isJson ? 'json' : undefined,
                options: {
                    keep_alive: this.config.keepAlive,
                    temperature: 0.2
                }
            });

            const content = response.message.content;

            this._log('AI: Raw Response (Ollama)', { model: modelName, rawText: content });

            if (isJson) {
                try {
                    const parsed = JSON.parse(content);
                    return {
                        text: parsed.description || "Generated successfully",
                        suggestedCode: parsed.openscad_code,
                        metadata: { name: parsed.name, parameters: parsed.parameters }
                    };
                } catch {
                    this._log('Ollama JSON Parse Error', { content });
                    return this._parseResponse(content);
                }
            }

            const result = this._parseResponse(content);
            this._log('Ollama Response', { model: modelName, response: result.text });
            return result;
        } catch (err) {
            this._log('Ollama Error', { error: err.message });
            console.error("Ollama Error:", err);
            return { text: `Ollama Error: ${err.message}`, suggestedCode: null };
        }
    }

    _parseResponse(content) {
        if (!content) return { text: "No response from AI", suggestedCode: null, metadata: null };

        // Match code blocks
        const codeMatch = content.match(/```(?:openscad|scad)?([\s\S]*?)```/i);
        let suggestedCode = codeMatch ? codeMatch[1].trim() : null;

        // Clean up suggested code if AI accidentally puts JSON comments in it
        if (suggestedCode) {
            suggestedCode = suggestedCode.replace(/^\/\/ JSON data[\s\S]*?\*\//i, '').trim();
        }

        // Match JSON metadata block
        const jsonMatch = content.match(/```json([\s\S]*?)```/i);
        let metadata = null;
        if (jsonMatch) {
            try {
                metadata = JSON.parse(jsonMatch[1].trim());
            } catch (e) {
                console.warn("Failed to parse AI metadata JSON:", e);
            }
        }

        // Clean text content
        let text = content
            .replace(/```(?:openscad|scad)?[\s\S]*?```/gi, '')
            .replace(/```json[\s\S]*?```/gi, '')
            .replace(/\/\*[\s\S]*?\*\/ /g, '') // Remove large comment blocks from text
            .trim();

        if (!text && suggestedCode) {
            text = "Code generated successfully.";
        } else if (!text) {
            text = content;
        }

        return { text, suggestedCode, metadata };
    }
}

export const aiService = new AIService();
