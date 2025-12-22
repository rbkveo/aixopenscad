import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const WIKI_DIR = path.join(__dirname, '../rag_data/BOSL2.wiki');
const OUTPUT_FILE = path.join(__dirname, '../public/bosl2_index.json');
const OLLAMA_HOST = 'http://100.79.78.30:11434'; // Remote host
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

function chunkMarkdown(text, source) {
    const chunks = [];
    // Split by Section headers
    const sections = text.split(/^###?\s+/m);

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

async function index() {
    console.log('--- Starting BOSL2 Indexing ---');
    const files = fs.readdirSync(WIKI_DIR).filter(f => f.endsWith('.md'));
    const allKnowledge = [];

    for (const file of files) {
        // Skip some less relevant files
        if (file === 'Home.md' || file === 'TOC.md' || file === '_Sidebar.md' || file === '_Footer.md') continue;

        console.log(`Processing: ${file}`);
        const content = fs.readFileSync(path.join(WIKI_DIR, file), 'utf8');
        const chunks = chunkMarkdown(content, file);

        for (let i = 0; i < chunks.length; i++) {
            process.stdout.write(`  Chunk ${i + 1}/${chunks.length}... `);
            const embedding = await getEmbedding(chunks[i].content);
            if (embedding) {
                allKnowledge.push({
                    content: chunks[i].content,
                    embedding: embedding,
                    metadata: chunks[i].metadata
                });
                console.log(' Done.');
            } else {
                console.log(' Failed.');
            }
        }
    }

    console.log(`--- Saving ${allKnowledge.length} chunks to ${OUTPUT_FILE} ---`);
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(allKnowledge, null, 2));
    console.log('Success!');
}

index().catch(console.error);
