import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const RAG_DATA_DIR = path.join(__dirname, '../rag_data');
const EXAMPLES_DIR = path.join(RAG_DATA_DIR, 'examples');
const OUTPUT_FILE = path.join(__dirname, '../public/openscad_index.json');
const OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://100.79.78.30:11434';
const EMBED_MODEL = 'nomic-embed-text';

async function getEmbedding(text) {
    try {
        const response = await fetch(`${OLLAMA_HOST}/api/embeddings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: EMBED_MODEL,
                prompt: text
            })
        });
        const data = await response.json();
        return data.embedding;
    } catch (e) {
        console.error(' - Embedding failed:', e.message);
        return null;
    }
}

function extractKeywords(content) {
    const keywords = [];
    const patterns = {
        holes: /\b(hole|cylinder|difference|drill|bore|countersink|counterbore)\b/gi,
        rounding: /\b(round|minkowski|sphere|fillet|smooth|edge)\b/gi,
        chamfer: /\b(chamfer|bevel|angle|45)\b/gi,
        patterns: /\b(pattern|array|grid|circular|linear|for\s*\()\b/gi,
        boolean: /\b(difference|union|intersection|hull)\b/gi
    };

    for (const [category, pattern] of Object.entries(patterns)) {
        if (pattern.test(content)) {
            keywords.push(category);
        }
    }

    return [...new Set(keywords)];
}

function determineTechnique(filePath, content) {
    if (filePath.includes('/holes/')) return 'holes';
    if (filePath.includes('/rounding/')) return 'rounding';
    if (filePath.includes('/fillets/')) return 'fillets';
    if (filePath.includes('/chamfers/')) return 'chamfers';
    if (filePath.includes('/patterns/')) return 'patterns';

    // Fallback to content analysis
    const keywords = extractKeywords(content);
    return keywords[0] || 'general';
}

function chunkMarkdown(text, source) {
    const chunks = [];
    // Split by Section headers (## or ###)
    const sections = text.split(/^#{2,3}\s+/m);

    for (let section of sections) {
        if (!section.trim()) continue;

        // Truncate/Chunk if too long
        if (section.length > 1500) {
            const parts = section.match(/[\s\S]{1,1500}/g) || [];
            parts.forEach(p => chunks.push({ content: p, metadata: { source } }));
        } else {
            chunks.push({ content: section, metadata: { source } });
        }
    }
    return chunks;
}

async function processMarkdownFiles() {
    console.log('--- Processing Markdown Documentation ---');
    const allKnowledge = [];

    const mdFiles = [
        'openscad_techniques.md',
        'openscad_reference.md'
    ];

    for (const file of mdFiles) {
        const filePath = path.join(RAG_DATA_DIR, file);
        if (!fs.existsSync(filePath)) {
            console.log(`Skipping ${file} (not found)`);
            continue;
        }

        console.log(`Processing: ${file}`);
        const content = fs.readFileSync(filePath, 'utf8');
        const chunks = chunkMarkdown(content, file);

        for (let i = 0; i < chunks.length; i++) {
            process.stdout.write(`  Chunk ${i + 1}/${chunks.length}... `);
            const embedding = await getEmbedding(chunks[i].content);
            if (embedding) {
                const keywords = extractKeywords(chunks[i].content);
                allKnowledge.push({
                    content: chunks[i].content,
                    embedding: embedding,
                    metadata: {
                        ...chunks[i].metadata,
                        type: 'documentation',
                        keywords: keywords,
                        cgal_safe: chunks[i].content.includes('eps =')
                    }
                });
                console.log(' Done.');
            } else {
                console.log(' Failed.');
            }
        }
    }

    return allKnowledge;
}

async function processExampleFiles() {
    console.log('--- Processing Example Files ---');
    const allKnowledge = [];

    if (!fs.existsSync(EXAMPLES_DIR)) {
        console.log('Examples directory not found, skipping...');
        return allKnowledge;
    }

    const categories = fs.readdirSync(EXAMPLES_DIR);

    for (const category of categories) {
        const categoryPath = path.join(EXAMPLES_DIR, category);
        if (!fs.statSync(categoryPath).isDirectory()) continue;

        console.log(`Processing category: ${category}`);
        const files = fs.readdirSync(categoryPath).filter(f => f.endsWith('.scad'));

        for (const file of files) {
            process.stdout.write(`  ${file}... `);
            const filePath = path.join(categoryPath, file);
            const content = fs.readFileSync(filePath, 'utf8');

            const embedding = await getEmbedding(content);
            if (embedding) {
                const keywords = extractKeywords(content);
                const technique = determineTechnique(filePath, content);

                allKnowledge.push({
                    content: content,
                    embedding: embedding,
                    metadata: {
                        source: `examples/${category}/${file}`,
                        type: 'example',
                        technique: technique,
                        keywords: keywords,
                        cgal_safe: content.includes('eps ='),
                        category: category
                    }
                });
                console.log(' Done.');
            } else {
                console.log(' Failed.');
            }
        }
    }

    return allKnowledge;
}

async function index() {
    console.log('=== Starting OpenSCAD Documentation Indexing ===');
    console.log(`Ollama Host: ${OLLAMA_HOST}`);
    console.log(`Embed Model: ${EMBED_MODEL}\n`);

    const docKnowledge = await processMarkdownFiles();
    const exampleKnowledge = await processExampleFiles();

    const allKnowledge = [...docKnowledge, ...exampleKnowledge];

    console.log(`\n--- Saving ${allKnowledge.length} chunks to ${OUTPUT_FILE} ---`);
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(allKnowledge, null, 2));
    console.log('✓ Success!');
    console.log(`\nIndexed:`);
    console.log(`  - ${docKnowledge.length} documentation chunks`);
    console.log(`  - ${exampleKnowledge.length} example files`);
}

index().catch(console.error);
