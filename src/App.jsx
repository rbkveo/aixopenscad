import React, { useState, useRef, useEffect } from 'react';
import CodeEditor from './components/Editor/CodeEditor';
import ThreeDViewer from './components/Viewer/3DViewer';
import { openSCADService } from './services/OpenSCADService';
import { aiService } from './services/AIService';
import { localDBService } from './services/LocalDBService';
import { ragService } from './services/RAGService';
import { imageService } from './services/ImageService';
import {
  Send, Box, Code, Settings, MessageSquare,
  PanelLeftClose, PanelLeft, Terminal, Loader2,
  User, History, Download, Plus, Trash2, Database,
  RefreshCw, Paperclip, X
} from 'lucide-react';
import './App.css';
import './image-upload-styles.css';

function App() {
  // Model & State
  const [code, setCode] = useState(`// Welcome to AiXopenscad\n// Desgin parametric 3D models with AI\n\nmodule example() {\n  difference() {\n    cube(10, center=true);\n    sphere(r=7);\n  }\n}\n\nexample();`);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeTab, setActiveTab] = useState('chat'); // 'chat', 'params', 'debug', 'history'
  const [isCompiling, setIsCompiling] = useState(false);
  const [lastOutput, setLastOutput] = useState(null);
  const [screenshot, setScreenshot] = useState(null);
  const [chatInput, setChatInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [pipelineStatus, setPipelineStatus] = useState('');
  const [pipelineLogs, setPipelineLogs] = useState([]);
  const [messages, setMessages] = useState([
    { role: 'ai', content: 'Hello! I am your AI designer. How can I help you today? You can describe a 3D object, or upload a drawing.' }
  ]);

  // Image upload state
  const [uploadedImage, setUploadedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const fileInputRef = useRef(null);

  // Persistence (Local)
  const [activeChat, setActiveChat] = useState(null);
  const [chats, setChats] = useState([]);

  // AI Config (with local persistence)
  const [availableModels, setAvailableModels] = useState([]);
  const [reasoningProvider, setReasoningProvider] = useState(() => localStorage.getItem('reasoningProvider') || 'ollama');
  const [reasoningModel, setReasoningModel] = useState(() => localStorage.getItem('reasoningModel') || 'devstral-small-2:24b');
  const [visionProvider, setVisionProvider] = useState(() => localStorage.getItem('visionProvider') || 'ollama');
  const [visionModel, setVisionModel] = useState(() => localStorage.getItem('visionModel') || 'qwen3-vl:32b');

  const [ollamaHost, setOllamaHost] = useState(() => localStorage.getItem('ollamaHost') || 'http://localhost:11434');
  const [isIndexing, setIsIndexing] = useState(false);

  const [config, setConfig] = useState(() => {
    const saved = localStorage.getItem('aiConfig');
    return saved ? JSON.parse(saved) : {
      keepAlive: '5m',
      enableVisualQA: true,
      enableRAG: true
    };
  });

  const [expandedLogId, setExpandedLogId] = useState(null);

  const viewerRef = useRef(null);
  const chatEndRef = useRef(null);

  // Initialization
  useEffect(() => {
    const init = async () => {
      // Fetch models
      const models = await aiService.getAvailableModels();
      setAvailableModels(models);

      // Load local design history
      fetchChats();
    };
    init();
  }, []);

  const fetchChats = async () => {
    const { data } = await localDBService.getChats();
    if (data) setChats(data);
  };

  useEffect(() => {
    aiService.setReasoningProvider(reasoningProvider);
    aiService.setReasoningModel(reasoningModel);
    aiService.setVisionProvider(visionProvider);
    aiService.setVisionModel(visionModel);
    aiService.setConfig(config);
    ragService.setOllamaHost(ollamaHost);

    // Persist settings
    localStorage.setItem('reasoningProvider', reasoningProvider);
    localStorage.setItem('reasoningModel', reasoningModel);
    localStorage.setItem('visionProvider', visionProvider);
    localStorage.setItem('visionModel', visionModel);
    localStorage.setItem('aiConfig', JSON.stringify(config));
    localStorage.setItem('ollamaHost', ollamaHost);
  }, [reasoningProvider, reasoningModel, visionProvider, visionModel, config, ollamaHost]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  // Chat/Pipeline Logic
  const runPipeline = async (prompt, initialCode, imageData = null) => {
    setIsTyping(true);
    setPipelineStatus('Thinking...');

    let currentPipelineCode = initialCode;
    let finalExplanation = "";
    let attempts = 0;
    const maxAttempts = 3;
    let compilationSuccess = false;
    let modelMetadata = null;

    try {
      // 1. Initial Generation
      const response = await aiService.sendMessage(prompt, {
        currentCode: initialCode,
        screenshot,
        imageData  // Pass uploaded technical drawing
      });

      currentPipelineCode = response.suggestedCode || currentPipelineCode;
      finalExplanation = response.text;
      modelMetadata = response.metadata;

      // 2. Compilation Loop (Self-Healing)
      while (attempts < maxAttempts && !compilationSuccess) {
        attempts++;
        setPipelineStatus(attempts > 1 ? `Re-fixing (Attempt ${attempts})...` : 'Compiling...');

        const result = await openSCADService.compile(currentPipelineCode);

        if (result.error) {
          console.warn(`Pipeline: Compilation attempt ${attempts} failed.`, result.error);
          console.warn(`Error type: ${result.errorType || 'UNKNOWN'}`);

          // Show validation warnings if present
          if (result.validationWarnings && result.validationWarnings.length > 0) {
            console.warn('Validation warnings:', result.validationWarnings);
          }

          setPipelineStatus(`Fixing ${result.errorType || 'error'}...`);

          const fixResponse = await aiService.fixCode(
            result.errorType || result.error,
            result.logs,
            {
              currentCode: currentPipelineCode,
              errorType: result.errorType,
              validationWarnings: result.validationWarnings
            }
          );

          if (fixResponse.suggestedCode) {
            currentPipelineCode = fixResponse.suggestedCode;
          } else {
            break;
          }
        } else {
          compilationSuccess = true;
          setLastOutput(result.stlData);
        }
      }

      // 3. Visual Verification
      if (compilationSuccess && config.enableVisualQA) {
        setPipelineStatus('Verifying visually...');
        await new Promise(r => setTimeout(r, 800));

        if (viewerRef.current) {
          const newScreenshot = viewerRef.current.captureScreenshot();
          const visualFeedback = await aiService.analyzeVisuals(newScreenshot, prompt, currentPipelineCode);

          if (visualFeedback.text.includes('LOOKS GOOD')) {
            finalExplanation += "\n\n(Visual verification passed!)";
          } else {
            finalExplanation += `\n\n(Visual QA noted some issues: ${visualFeedback.text})`;
          }
        }
      } else if (!compilationSuccess) {
        finalExplanation += "\n\n(Note: I couldn't resolve all compilation errors after several attempts.)";
      }

      // Final Sync
      if (compilationSuccess) {
        setCode(currentPipelineCode);
      }

      // Update UI
      const aiMsg = {
        role: 'ai',
        content: finalExplanation,
        suggestedCode: currentPipelineCode,
        compilationSuccess,
        metadata: modelMetadata
      };

      setPipelineLogs([...aiService.getLogs()]);
      setMessages(prev => [...prev, aiMsg]);

      // PERSISTENCE (Local)
      let chatId = activeChat?.id;

      if (!chatId) {
        // Create new chat entry locally
        const name = modelMetadata?.name || "New Design";
        const desc = modelMetadata?.description || prompt.substring(0, 100);
        const { data } = await localDBService.createChat(name, desc);
        if (data) {
          chatId = data.id;
          setActiveChat(data);
        }
      } else if (modelMetadata) {
        // Update chat metadata locally
        await localDBService.updateChat(chatId, {
          name: modelMetadata.name,
          description: modelMetadata.description
        });
      }

      if (chatId) {
        // Save messages locally
        await localDBService.saveMessage(chatId, 'user', prompt, { screenshot });
        await localDBService.saveMessage(chatId, 'ai', finalExplanation, {
          suggestedCode: currentPipelineCode,
          metadata: modelMetadata
        });
        fetchChats();
      }

    } catch (err) {
      console.error("Pipeline Error:", err);
      setMessages(prev => [...prev, { role: 'ai', content: "Sorry, the design pipeline crashed: " + err.message }]);
    } finally {
      setIsTyping(false);
      setPipelineStatus('');
    }
  };

  // Image upload handlers
  const handleImageSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      imageService.validateImage(file);
      const processedImage = await imageService.prepareForVision(file);
      setUploadedImage(processedImage);
      setImagePreview(processedImage.data);
    } catch (error) {
      alert(error.message);
      console.error('Image upload failed:', error);
    }
  };

  const handleRemoveImage = () => {
    setUploadedImage(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSendMessage = async () => {
    if (!chatInput.trim() || isTyping) return;
    const userMsg = chatInput;
    const imageData = uploadedImage;

    setChatInput('');
    setUploadedImage(null);
    setImagePreview(null);

    setMessages(prev => [...prev, {
      role: 'user',
      content: userMsg,
      screenshot,
      image: imageData
    }]);

    await runPipeline(userMsg, code, imageData);
  };

  const handleGenerate = async () => {
    setIsCompiling(true);
    try {
      const result = await openSCADService.compile(code);
      if (result.stlData) {
        setLastOutput(result.stlData);
      }
      setTimeout(() => {
        if (viewerRef.current) setScreenshot(viewerRef.current.captureScreenshot());
      }, 500);
    } catch (err) {
      console.error("Generation failed:", err);
    } finally {
      setIsCompiling(false);
    }
  };

  const handleDownloadSTL = () => {
    if (!lastOutput) return;
    const blob = new Blob([lastOutput], { type: 'application/sla' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const fileName = activeChat?.name ? `${activeChat.name.replace(/\s+/g, '_')}.stl` : `model_${Date.now()}.stl`;
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleSyncRAG = async () => {
    setIsIndexing(true);
    setPipelineStatus('Syncing Knowledge Base...');
    try {
      // For now, we fetch a pre-generated index from public/bosl2_index.json
      // The user will need to run the indexing script once.
      const response = await fetch('/bosl2_index.json');
      if (!response.ok) throw new Error("Index file not found. Run the indexing script first.");

      const knowledge = await response.json();
      await localDBService.clearKnowledge();

      for (let item of knowledge) {
        await localDBService.saveKnowledgeChunk(item.content, item.embedding, item.metadata);
      }

      alert(`Synchronized ${knowledge.length} BOSL2 knowledge chunks!`);
    } catch (e) {
      console.error("Sync failed:", e);
      alert("Failed to sync knowledge: " + e.message);
    } finally {
      setIsIndexing(false);
      setPipelineStatus('');
    }
  };

  const startNewChat = () => {
    setActiveChat(null);
    setMessages([{ role: 'ai', content: 'Ready for a new design! What should we create?' }]);
    setCode(`// New Project\n\n`);
    setLastOutput(null);
  };

  const loadChat = async (chat) => {
    setActiveChat(chat);
    setActiveTab('chat');
    setIsTyping(true);

    const { data } = await localDBService.getMessages(chat.id);
    if (data) {
      const formattedMessages = data.map(m => ({
        role: m.role,
        content: m.content,
        suggestedCode: m.metadata?.suggestedCode,
        screenshot: m.metadata?.screenshot
      }));
      setMessages(formattedMessages);

      // Load last code if present
      const lastAiMsg = [...formattedMessages].reverse().find(m => m.suggestedCode);
      if (lastAiMsg) setCode(lastAiMsg.suggestedCode);
    }
    setIsTyping(false);
  };

  const deleteChatHistory = async (e, chatId) => {
    e.stopPropagation();
    if (window.confirm("Delete this design history?")) {
      await localDBService.deleteChat(chatId);
      if (activeChat?.id === chatId) startNewChat();
      fetchChats();
    }
  };

  return (
    <div className="app-container">
      <header className="app-header glass">
        <div className="header-left">
          <button className="icon-button" onClick={() => setSidebarOpen(!sidebarOpen)}>
            {sidebarOpen ? <PanelLeftClose size={20} /> : <PanelLeft size={20} />}
          </button>
          <div className="logo">
            <Box className="logo-icon" size={24} color="var(--accent-primary)" />
            <span className="logo-text">AiX<span>openscad</span></span>
          </div>
        </div>

        <div className="header-center">
          <div className="project-name">{activeChat?.name || "Untitled Model"} (Local)</div>
        </div>

        <div className="header-right">
          <button className="button-outline button-icon-only" onClick={startNewChat} title="New Chat">
            <Plus size={20} />
          </button>

          {lastOutput && (
            <button className="button-outline button-icon-only" onClick={handleDownloadSTL} title="Download STL">
              <Download size={20} />
            </button>
          )}

          <button className="button-primary" onClick={handleGenerate} disabled={isCompiling}>
            {isCompiling ? <Loader2 className="animate-spin" size={16} /> : "Generate"}
          </button>
        </div>
      </header>

      <main className="app-content">
        <aside className={`app-sidebar glass ${sidebarOpen ? 'open' : 'closed'}`}>
          <div className="sidebar-tabs">
            <button className={`tab ${activeTab === 'chat' ? 'active' : ''}`} onClick={() => setActiveTab('chat')}>
              <MessageSquare size={18} /><span>Chat</span>
            </button>
            <button className={`tab ${activeTab === 'history' ? 'active' : ''}`} onClick={() => setActiveTab('history')}>
              <History size={18} /><span>History</span>
            </button>
            <button className={`tab ${activeTab === 'params' ? 'active' : ''}`} onClick={() => setActiveTab('params')}>
              <Settings size={18} /><span>AI</span>
            </button>
            <button className={`tab ${activeTab === 'debug' ? 'active' : ''}`} onClick={() => setActiveTab('debug')}>
              <Terminal size={18} /><span>Logs</span>
            </button>
          </div>

          <div className="sidebar-content">
            {activeTab === 'chat' && (
              <div className="sidebar-chat">
                <div className="chat-history">
                  {messages.map((msg, i) => (
                    <div key={i} className={`chat-message ${msg.role}`}>
                      <div className="message-header">
                        {msg.role === 'ai' ? <Box size={14} /> : <User size={14} />}
                        <span>{msg.role === 'ai' ? 'AI' : 'You'}</span>
                      </div>
                      <div className="message-content">
                        <p>{msg.content}</p>
                        {msg.screenshot && msg.role === 'user' && (
                          <div className="screenshot-preview"><img src={msg.screenshot} alt="Visual Context" /></div>
                        )}
                        {msg.suggestedCode && (
                          <div className="suggested-code-block">
                            <button className="button-apply" onClick={() => { setCode(msg.suggestedCode); setTimeout(handleGenerate, 100); }}>
                              <Code size={14} /><span>Apply Code</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  {isTyping && (
                    <div className="chat-message ai typing">
                      <div className="typing-indicator-container">
                        <div className="typing-indicator"><span></span><span></span><span></span></div>
                        {pipelineStatus && <span className="pipeline-status-text">{pipelineStatus}</span>}
                      </div>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>
                <div className="chat-input-area">
                  {imagePreview && (
                    <div className="image-preview-container">
                      <img src={imagePreview} alt="Upload preview" className="image-preview" />
                      <button className="image-remove-btn" onClick={handleRemoveImage} title="Remove image">
                        <X size={16} />
                      </button>
                    </div>
                  )}
                  <div className="chat-input-wrapper">
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleImageSelect}
                      accept="image/*"
                      style={{ display: 'none' }}
                    />
                    <button
                      className="image-upload-btn"
                      onClick={() => fileInputRef.current?.click()}
                      title="Upload technical drawing"
                      disabled={isTyping}
                    >
                      <Paperclip size={18} />
                    </button>
                    <textarea
                      placeholder="Describe your model or upload a drawing..."
                      className="chat-textarea"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSendMessage())}
                    />
                    <button className="chat-send-btn" onClick={handleSendMessage} disabled={isTyping || !chatInput.trim()}>
                      {isTyping ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'history' && (
              <div className="sidebar-history">
                <button className="new-chat-btn" onClick={startNewChat}><Plus size={18} /> New Design</button>
                {chats.length === 0 ? (
                  <div className="no-logs">No saved designs Yet</div>
                ) : (
                  chats.map(chat => (
                    <div key={chat.id} className={`history-item ${activeChat?.id === chat.id ? 'active' : ''}`} onClick={() => loadChat(chat)}>
                      <div className="history-item-header">
                        <h4>{chat.name}</h4>
                        <button className="delete-btn" onClick={(e) => deleteChatHistory(e, chat.id)}><Trash2 size={12} /></button>
                      </div>
                      <p>{chat.description}</p>
                      <div className="meta">
                        <span>{new Date(chat.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {activeTab === 'params' && (
              <div className="sidebar-params">
                {/* Generation / Reasoning Section */}
                <div className="params-section-title">Generation & Reasoning</div>
                <div className="params-group">
                  <label className="params-label">Provider</label>
                  <div className="provider-toggle">
                    <button className={reasoningProvider === 'ollama' ? 'active' : ''} onClick={() => {
                      setReasoningProvider('ollama');
                      const first = availableModels.find(m => m.provider === 'ollama');
                      if (first) setReasoningModel(first.id);
                    }}>Ollama</button>
                    <button className={reasoningProvider === 'gemini' ? 'active' : ''} onClick={() => {
                      setReasoningProvider('gemini');
                      setReasoningModel('gemini-2.0-flash');
                    }}>Gemini</button>
                  </div>
                </div>
                <div className="params-group">
                  <label className="params-label">Reasoning Model</label>
                  <select className="params-select" value={reasoningModel} onChange={(e) => setReasoningModel(e.target.value)}>
                    {availableModels.filter(m => m.provider === reasoningProvider).map(m => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                </div>

                <div className="params-divider" />

                {/* Visual Analysis Section */}
                <div className="params-section-title">Visual Analysis (QA)</div>
                <div className="params-group">
                  <label className="params-label">Provider</label>
                  <div className="provider-toggle">
                    <button className={visionProvider === 'ollama' ? 'active' : ''} onClick={() => {
                      setVisionProvider('ollama');
                      const first = availableModels.find(m => m.provider === 'ollama');
                      if (first) setVisionModel(first.id);
                    }}>Ollama</button>
                    <button className={visionProvider === 'gemini' ? 'active' : ''} onClick={() => {
                      setVisionProvider('gemini');
                      setVisionModel('gemini-2.0-flash');
                    }}>Gemini</button>
                  </div>
                </div>
                <div className="params-group">
                  <label className="params-label">Vision Model</label>
                  <select className="params-select" value={visionModel} onChange={(e) => setVisionModel(e.target.value)}>
                    {availableModels.filter(m => m.provider === visionProvider).map(m => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                </div>

                <div className="params-divider" />

                <div className="params-section-title"><Database size={14} style={{ marginRight: 8 }} />RAG Knowledge (BOSL2)</div>
                <div className="params-group">
                  <label className="params-label">Ollama Host (Remote/Local)</label>
                  <input
                    type="text"
                    className="params-input"
                    value={ollamaHost}
                    onChange={(e) => setOllamaHost(e.target.value)}
                    placeholder="http://10.x.x.x:11434"
                  />
                </div>
                <div className="params-group checkbox-group">
                  <label className="checkbox-label">
                    <input type="checkbox" checked={config.enableRAG} onChange={(e) => setConfig({ ...config, enableRAG: e.target.checked })} />
                    <span>Enable RAG</span>
                  </label>
                </div>
                <button className="button-outline w-full" onClick={handleSyncRAG} disabled={isIndexing}>
                  {isIndexing ? <RefreshCw className="animate-spin" size={16} /> : <RefreshCw size={16} />}
                  <span style={{ marginLeft: 8 }}>Sync Knowledge Base</span>
                </button>
              </div>
            )}

            {activeTab === 'debug' && (
              <div className="sidebar-debug">
                <div className="debug-header">
                  <h3>Logs</h3>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      className="clear-logs"
                      onClick={() => {
                        const { loggingService } = require('./services/LoggingService');
                        loggingService.downloadLogsAsText();
                      }}
                      title="Download logs as text file"
                    >
                      <Download size={14} /> Download
                    </button>
                    <button
                      className="clear-logs"
                      onClick={() => {
                        aiService.clearLogs();
                        setPipelineLogs([]);
                        const { loggingService } = require('./services/LoggingService');
                        loggingService.clearLogs();
                      }}
                    >
                      Clear
                    </button>
                  </div>
                </div>
                <div className="debug-logs">
                  {pipelineLogs.length === 0 ? <div className="no-logs">No logs yet</div> :
                    pipelineLogs.map((log, i) => (
                      <div
                        key={i}
                        className={`log-entry ${expandedLogId === i ? 'expanded' : ''}`}
                        onClick={() => setExpandedLogId(expandedLogId === i ? null : i)}
                      >
                        <div className="log-time">{new Date(log.timestamp).toLocaleTimeString()}</div>
                        <div className="log-step">{log.step}</div>
                        <pre className="log-data">{JSON.stringify(log, null, 2)}</pre>
                      </div>
                    ))
                  }
                </div>
              </div>
            )}
          </div>
        </aside>

        <div className="workspace">
          <div className="pane editor-pane">
            <div className="pane-header"><Code size={16} /><span>Code</span></div>
            <div className="pane-content"><CodeEditor code={code} onChange={setCode} /></div>
          </div>
          <div className="pane viewer-pane">
            <div className="pane-header"><Box size={16} /><span>Preview</span></div>
            <div className="pane-content"><ThreeDViewer ref={viewerRef} stlData={lastOutput} /></div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
