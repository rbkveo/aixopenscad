/**
 * Enhanced Logging Service
 * Saves detailed logs to browser storage and provides download functionality
 */
class LoggingService {
    constructor() {
        this.logs = [];
        this.maxLogs = 1000; // Keep last 1000 log entries
        this.sessionId = Date.now();
    }

    /**
     * Log an entry with full text preservation
     */
    log(category, step, data) {
        const entry = {
            timestamp: new Date().toISOString(),
            sessionId: this.sessionId,
            category,
            step,
            data: this._cloneData(data)
        };

        this.logs.push(entry);

        // Trim old logs
        if (this.logs.length > this.maxLogs) {
            this.logs = this.logs.slice(-this.maxLogs);
        }

        // Save to localStorage periodically
        this._saveToStorage();

        // Console output with full text
        this._consoleLog(category, step, data);

        return entry;
    }

    /**
     * Deep clone data to preserve full strings
     */
    _cloneData(data) {
        if (typeof data === 'string') {
            return data;
        }
        if (Array.isArray(data)) {
            return data.map(item => this._cloneData(item));
        }
        if (data && typeof data === 'object') {
            const cloned = {};
            for (const [key, value] of Object.entries(data)) {
                cloned[key] = this._cloneData(value);
            }
            return cloned;
        }
        return data;
    }

    /**
     * Enhanced console logging with full text display
     */
    _consoleLog(category, step, data) {
        const color = this._getCategoryColor(category);
        console.log(`%c[${category}][${step}]`, `color: ${color}; font-weight: bold`);

        if (typeof data === 'string') {
            console.log(`  Text (${data.length} chars):`);
            console.log(data);
        } else if (data && typeof data === 'object') {
            for (const [key, value] of Object.entries(data)) {
                if (typeof value === 'string' && value.length > 100) {
                    console.log(`  ${key} (${value.length} chars):`);
                    console.log(value);
                } else {
                    console.log(`  ${key}:`, value);
                }
            }
        } else {
            console.log(data);
        }
    }

    _getCategoryColor(category) {
        const colors = {
            'Pipeline': '#4CAF50',
            'RAG': '#2196F3',
            'OpenSCAD': '#FF9800',
            'Error': '#F44336',
            'AI': '#9C27B0'
        };
        return colors[category] || '#607D8B';
    }

    /**
     * Save logs to localStorage
     */
    _saveToStorage() {
        try {
            // Only save last 100 logs to avoid quota issues
            const recentLogs = this.logs.slice(-100);
            localStorage.setItem('app_logs', JSON.stringify(recentLogs));
        } catch (e) {
            console.warn('Failed to save logs to localStorage:', e);
        }
    }

    /**
     * Load logs from localStorage
     */
    loadFromStorage() {
        try {
            const stored = localStorage.getItem('app_logs');
            if (stored) {
                this.logs = JSON.parse(stored);
            }
        } catch (e) {
            console.warn('Failed to load logs from localStorage:', e);
        }
    }

    /**
     * Get all logs
     */
    getAllLogs() {
        return this.logs;
    }

    /**
     * Get logs for current session
     */
    getSessionLogs() {
        return this.logs.filter(log => log.sessionId === this.sessionId);
    }

    /**
     * Clear all logs
     */
    clearLogs() {
        this.logs = [];
        localStorage.removeItem('app_logs');
    }

    /**
     * Download logs as JSON file
     */
    downloadLogs(filename = null) {
        const name = filename || `openscad_logs_${new Date().toISOString().replace(/:/g, '-')}.json`;
        const content = JSON.stringify(this.logs, null, 2);
        const blob = new Blob([content], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = name;
        link.click();
        URL.revokeObjectURL(url);
    }

    /**
     * Download logs as readable text file
     */
    downloadLogsAsText(filename = null) {
        const name = filename || `openscad_logs_${new Date().toISOString().replace(/:/g, '-')}.txt`;
        const lines = [];

        for (const log of this.logs) {
            lines.push('='.repeat(80));
            lines.push(`[${log.timestamp}] [${log.category}] ${log.step}`);
            lines.push('-'.repeat(80));

            if (typeof log.data === 'string') {
                lines.push(log.data);
            } else if (log.data && typeof log.data === 'object') {
                for (const [key, value] of Object.entries(log.data)) {
                    lines.push(`${key}:`);
                    if (typeof value === 'string') {
                        lines.push(value);
                    } else {
                        lines.push(JSON.stringify(value, null, 2));
                    }
                    lines.push('');
                }
            }
            lines.push('');
        }

        const content = lines.join('\n');
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = name;
        link.click();
        URL.revokeObjectURL(url);
    }

    /**
     * Get logs filtered by category
     */
    getLogsByCategory(category) {
        return this.logs.filter(log => log.category === category);
    }

    /**
     * Search logs by text
     */
    searchLogs(query) {
        const lowerQuery = query.toLowerCase();
        return this.logs.filter(log => {
            const logStr = JSON.stringify(log).toLowerCase();
            return logStr.includes(lowerQuery);
        });
    }
}

export const loggingService = new LoggingService();

// Load existing logs on startup
loggingService.loadFromStorage();

// Expose to window for debugging
if (typeof window !== 'undefined') {
    window.loggingService = loggingService;
}
