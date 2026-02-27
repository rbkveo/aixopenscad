import React, { useState, useEffect } from 'react';
import { loggingService } from '../../services/LoggingService';
import { Search, Download, Trash2, ChevronDown, ChevronRight, Terminal } from 'lucide-react';

const AdminPanel = () => {
    const [logs, setLogs] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('All');
    const [expandedLogs, setExpandedLogs] = useState(new Set());

    const refreshLogs = React.useCallback(() => {
        setLogs([...loggingService.getAllLogs()].reverse());
    }, []);

    useEffect(() => {
        // Load initial logs
        refreshLogs();

        // Polling to keep logs updated if left open
        const interval = setInterval(refreshLogs, 5000);
        return () => clearInterval(interval);
    }, [refreshLogs]);

    const handleClearLogs = () => {
        if (window.confirm("Are you sure you want to clear all system logs?")) {
            loggingService.clearLogs();
            refreshLogs();
        }
    };

    const handleDownloadLogs = () => {
        loggingService.downloadLogsAsText();
    };

    const toggleExpand = (index) => {
        const newExpanded = new Set(expandedLogs);
        if (newExpanded.has(index)) {
            newExpanded.delete(index);
        } else {
            newExpanded.add(index);
        }
        setExpandedLogs(newExpanded);
    };

    // Filter Logic
    const filteredLogs = logs.filter(log => {
        const matchesCategory = categoryFilter === 'All' || log.category === categoryFilter;
        if (!matchesCategory) return false;

        if (!searchQuery) return true;

        const searchLower = searchQuery.toLowerCase();
        const dataString = typeof log.data === 'string' ? log.data : JSON.stringify(log.data);
        return (
            log.step.toLowerCase().includes(searchLower) ||
            log.category.toLowerCase().includes(searchLower) ||
            (dataString && dataString.toLowerCase().includes(searchLower))
        );
    });

    const categories = ['All', 'Pipeline', 'RAG', 'OpenSCAD', 'Error', 'AI'];

    return (
        <div className="admin-panel" style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '15px' }}>
            <div className="admin-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                    <Terminal size={20} /> System Logs
                </h2>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <button className="button-outline" onClick={handleDownloadLogs} title="Download Logs">
                        <Download size={14} style={{ marginRight: '5px' }} /> Download
                    </button>
                    <button className="button-outline" onClick={handleClearLogs} style={{ color: '#ef4444', borderColor: '#ef4444' }}>
                        <Trash2 size={14} style={{ marginRight: '5px' }} /> Clear
                    </button>
                </div>
            </div>

            <div className="admin-filters" style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
                <div className="search-box" style={{ flex: 1, position: 'relative' }}>
                    <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                    <input
                        type="text"
                        className="params-input"
                        placeholder="Search logs, raw AI responses..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        style={{ paddingLeft: '30px', width: '100%' }}
                    />
                </div>
                <select
                    className="params-select"
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    style={{ width: '150px' }}
                >
                    {categories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
            </div>

            <div className="admin-logs-container" style={{ flex: 1, overflowY: 'auto', backgroundColor: 'var(--bg-tertiary)', borderRadius: '8px', padding: '10px' }}>
                {filteredLogs.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>No logs found.</div>
                ) : (
                    filteredLogs.map((log, index) => (
                        <div key={index} style={{ marginBottom: '8px', backgroundColor: 'var(--bg-secondary)', borderRadius: '4px', overflow: 'hidden' }}>
                            <div
                                style={{ padding: '8px', display: 'flex', cursor: 'pointer', borderLeft: `3px solid ${loggingService._getCategoryColor(log.category)}` }}
                                onClick={() => toggleExpand(index)}
                            >
                                <div style={{ marginRight: '8px', color: 'var(--text-secondary)' }}>
                                    {expandedLogs.has(index) ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                </div>
                                <div style={{ minWidth: '80px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                    {new Date(log.timestamp).toLocaleTimeString()}
                                </div>
                                <div style={{ minWidth: '80px', fontWeight: 'bold', color: loggingService._getCategoryColor(log.category) }}>
                                    {log.category}
                                </div>
                                <div style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {log.step}
                                </div>
                            </div>

                            {
                                expandedLogs.has(index) && (
                                    <div style={{ padding: '10px', backgroundColor: '#0a0a0c', fontSize: '0.85rem', fontFamily: 'monospace', overflowX: 'auto', borderTop: '1px solid var(--border-color)' }}>
                                        {typeof log.data === 'string' ? (
                                            <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{log.data}</pre>
                                        ) : (
                                            <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: 'var(--text-secondary)' }}>
                                                {JSON.stringify(log.data, null, 2)}
                                            </pre>
                                        )}
                                    </div>
                                )
                            }
                        </div>
                    ))
                )}
            </div>
        </div >
    );
};

export default AdminPanel;
