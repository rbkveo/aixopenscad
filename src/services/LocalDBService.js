import { v4 as uuidv4 } from 'uuid';

const DB_NAME = 'AiXopenscadDB';
const DB_VERSION = 2;

class LocalDBService {
    constructor() {
        this.db = null;
        this.initPromise = this._initDB();
    }

    _initDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                // Chats Store
                if (!db.objectStoreNames.contains('chats')) {
                    const chatStore = db.createObjectStore('chats', { keyPath: 'id' });
                    chatStore.createIndex('created_at', 'created_at', { unique: false });
                }

                // Messages Store
                if (!db.objectStoreNames.contains('messages')) {
                    const messageStore = db.createObjectStore('messages', { keyPath: 'id' });
                    messageStore.createIndex('chat_id', 'chat_id', { unique: false });
                    messageStore.createIndex('created_at', 'created_at', { unique: false });
                }

                // Knowledge Store (RAG)
                if (!db.objectStoreNames.contains('knowledge')) {
                    const knowledgeStore = db.createObjectStore('knowledge', { keyPath: 'id' });
                    knowledgeStore.createIndex('source', 'source', { unique: false });
                }
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;
                resolve(this.db);
            };

            request.onerror = (event) => {
                console.error('IndexedDB Error:', event.target.error);
                reject(event.target.error);
            };
        });
    }

    async _ensureDB() {
        if (!this.db) await this.initPromise;
        return this.db;
    }

    /**
     * CHATS
     */
    async getChats() {
        const db = await this._ensureDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(['chats'], 'readonly');
            const store = transaction.objectStore('chats');
            const index = store.index('created_at');
            const request = index.getAll(); // By default oldest first? index helps ordering.

            request.onsuccess = () => {
                // Return sorted by date descending manually if getAll() doesn't respect index direction
                const sorted = request.result.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
                resolve({ data: sorted, error: null });
            };
            request.onerror = () => reject({ data: null, error: request.error });
        });
    }

    async createChat(name, description) {
        const db = await this._ensureDB();
        const chat = {
            id: uuidv4(),
            name,
            description,
            created_at: new Date().toISOString()
        };

        return new Promise((resolve, reject) => {
            const transaction = db.transaction(['chats'], 'readwrite');
            const store = transaction.objectStore('chats');
            const request = store.add(chat);

            request.onsuccess = () => resolve({ data: chat, error: null });
            request.onerror = () => reject({ data: null, error: request.error });
        });
    }

    async updateChat(chatId, updates) {
        const db = await this._ensureDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(['chats'], 'readwrite');
            const store = transaction.objectStore('chats');
            const getRequest = store.get(chatId);

            getRequest.onsuccess = () => {
                const data = { ...getRequest.result, ...updates };
                const putRequest = store.put(data);
                putRequest.onsuccess = () => resolve({ data, error: null });
                putRequest.onerror = () => reject({ data: null, error: putRequest.error });
            };
            getRequest.onerror = () => reject({ data: null, error: getRequest.error });
        });
    }

    async deleteChat(chatId) {
        const db = await this._ensureDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(['chats', 'messages'], 'readwrite');

            // Delete chat
            transaction.objectStore('chats').delete(chatId);

            // Delete related messages (simple approach: iterate or use index)
            const messageStore = transaction.objectStore('messages');
            const index = messageStore.index('chat_id');
            const request = index.openKeyCursor(IDBKeyRange.only(chatId));

            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    messageStore.delete(cursor.primaryKey);
                    cursor.continue();
                }
            };

            transaction.oncomplete = () => resolve({ error: null });
            transaction.onerror = () => reject({ error: transaction.error });
        });
    }

    /**
     * MESSAGES
     */
    async getMessages(chatId) {
        const db = await this._ensureDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(['messages'], 'readonly');
            const store = transaction.objectStore('messages');
            const index = store.index('chat_id');
            const request = index.getAll(IDBKeyRange.only(chatId));

            request.onsuccess = () => {
                const sorted = request.result.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
                resolve({ data: sorted, error: null });
            };
            request.onerror = () => reject({ data: null, error: request.error });
        });
    }

    async saveMessage(chatId, role, content, metadata = {}) {
        const db = await this._ensureDB();
        const message = {
            id: uuidv4(),
            chat_id: chatId,
            role,
            content,
            metadata,
            created_at: new Date().toISOString()
        };

        return new Promise((resolve, reject) => {
            const transaction = db.transaction(['messages'], 'readwrite');
            const store = transaction.objectStore('messages');
            const request = store.add(message);

            request.onsuccess = () => resolve({ data: message, error: null });
            request.onerror = () => reject({ data: null, error: request.error });
        });
    }

    /**
     * KNOWLEDGE (RAG)
     */
    async clearKnowledge() {
        const db = await this._ensureDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(['knowledge'], 'readwrite');
            const store = transaction.objectStore('knowledge');
            const request = store.clear();
            request.onsuccess = () => resolve({ error: null });
            request.onerror = () => reject({ error: request.error });
        });
    }

    async saveKnowledgeChunk(content, embedding, metadata = {}) {
        const db = await this._ensureDB();
        const chunk = {
            id: uuidv4(),
            content,
            embedding,
            source: metadata.source || 'unknown',
            metadata,
            created_at: new Date().toISOString()
        };

        return new Promise((resolve, reject) => {
            const transaction = db.transaction(['knowledge'], 'readwrite');
            const store = transaction.objectStore('knowledge');
            const request = store.add(chunk);
            request.onsuccess = () => resolve({ data: chunk, error: null });
            request.onerror = () => reject({ data: null, error: request.error });
        });
    }

    async getAllKnowledge() {
        const db = await this._ensureDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(['knowledge'], 'readonly');
            const store = transaction.objectStore('knowledge');
            const request = store.getAll();
            request.onsuccess = () => resolve({ data: request.result, error: null });
            request.onerror = () => reject({ data: null, error: request.error });
        });
    }
}

export const localDBService = new LocalDBService();
