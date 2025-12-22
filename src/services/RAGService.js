import { localDBService } from './LocalDBService';

class RAGService {
    constructor() {
        this.ollamaHost = localStorage.getItem('ollamaHost') || 'http://100.79.78.30:11434';
        this.embeddingModel = 'nomic-embed-text'; // Standard embedding model
        this.isIndexing = false;
    }

    setOllamaHost(host) {
        this.ollamaHost = host;
        localStorage.setItem('ollamaHost', host);
    }

    /**
     * Simple cosine similarity calculation
     */
    cosineSimilarity(vecA, vecB) {
        let dotProduct = 0;
        let normA = 0;
        let normB = 0;
        for (let i = 0; i < vecA.length; i++) {
            dotProduct += vecA[i] * vecB[i];
            normA += vecA[i] * vecA[i];
            normB += vecB[i] * vecB[i];
        }
        return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
    }

    async getEmbedding(text) {
        try {
            const response = await fetch(`${this.ollamaHost}/api/embeddings`, {
                method: 'POST',
                body: JSON.stringify({
                    model: this.embeddingModel,
                    prompt: text
                })
            });
            const data = await response.json();
            return data.embedding;
        } catch (e) {
            console.error('Embedding failed:', e);
            return null;
        }
    }

    /**
     * Chunk markdown text by headers or fixed size
     */
    chunkMarkdown(text, source) {
        const chunks = [];
        const sections = text.split(/^##\s+/m);

        for (let section of sections) {
            if (!section.trim()) continue;

            // Further split large sections if needed
            if (section.length > 2000) {
                const subChunks = section.match(/[\s\S]{1,2000}/g) || [];
                subChunks.forEach(sc => chunks.push({ text: sc, source }));
            } else {
                chunks.push({ text: section, source });
            }
        }
        return chunks;
    }

    /**
     * Retrieve relevant chunks for a query
     */
    async search(query, topK = 5) {
        const queryEmbedding = await this.getEmbedding(query);
        if (!queryEmbedding) return [];

        const { data: allKnowledge } = await localDBService.getAllKnowledge();
        if (!allKnowledge || allKnowledge.length === 0) return [];

        // Score and sort
        const results = allKnowledge.map(chunk => ({
            ...chunk,
            similarity: this.cosineSimilarity(queryEmbedding, chunk.embedding)
        }));

        return results
            .sort((a, b) => b.similarity - a.similarity)
            .slice(0, topK);
    }

    async indexFile(path, content) {
        const chunks = this.chunkMarkdown(content, path);
        for (let chunk of chunks) {
            const embedding = await this.getEmbedding(chunk.text);
            if (embedding) {
                await localDBService.saveKnowledgeChunk(chunk.text, embedding, { source: path });
            }
        }
    }
}

export const ragService = new RAGService();
