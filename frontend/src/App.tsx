import { useState, useRef, useEffect, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import "./App.css";

const API_BASE = "http://localhost:8000";

type Role = "user" | "assistant";

interface Message {
    id: string;
    role: Role;
    content: string;
    file?: { name: string; type: string; previewUrl?: string };
    isStreaming?: boolean;
}

function uid() {
    return Math.random().toString(36).slice(2);
}

function FilePreview({ file }: { file: Message["file"] }) {
    if (!file) return null;
    const isImage = file.type.startsWith("image/");
    return (
        <div className="file-chip">
            {isImage && file.previewUrl ? (
                <img src={file.previewUrl} alt={file.name} className="file-thumb" />
            ) : (
                <span className="file-icon">📄</span>
            )}
            <span className="file-name">{file.name}</span>
        </div>
    );
}

function TypingDots() {
    return (
        <span className="typing-dots">
            <span />
            <span />
            <span />
        </span>
    );
}

export default function App() {
    const [messages, setMessages] = useState<Message[]>([
        {
            id: uid(),
            role: "assistant",
            content:
                "Hey there! 👋 I'm your **Student AI Assistant**. I can help you understand concepts, analyze documents, and answer your questions.\n\nYou can also **upload a PDF or image** and I'll analyze it for you. What would you like to explore today?",
        },
    ]);
    const [input, setInput] = useState("");
    const [file, setFile] = useState<File | null>(null);
    const [filePreview, setFilePreview] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [sidebarOpen, setSidebarOpen] = useState(false);

    const bottomRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const handleFile = (f: File) => {
        setFile(f);
        if (f.type.startsWith("image/")) {
            const url = URL.createObjectURL(f);
            setFilePreview(url);
        } else {
            setFilePreview(null);
        }
    };

    const clearFile = () => {
        setFile(null);
        setFilePreview(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    const onDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const dropped = e.dataTransfer.files[0];
        if (dropped) handleFile(dropped);
    }, []);

    const buildHistory = () =>
        messages
            .filter((m) => !m.isStreaming && m.content)
            .map((m) => ({ role: m.role, content: m.content }));

    const sendMessage = async () => {
        const trimmed = input.trim();
        if (!trimmed && !file) return;
        if (isLoading) return;

        const userMsg: Message = {
            id: uid(),
            role: "user",
            content: trimmed || (file ? `Please analyze this file: ${file.name}` : ""),
            file: file
                ? {
                    name: file.name,
                    type: file.type,
                    previewUrl: filePreview || undefined,
                }
                : undefined,
        };

        const assistantId = uid();
        const assistantMsg: Message = {
            id: assistantId,
            role: "assistant",
            content: "",
            isStreaming: true,
        };

        setMessages((prev) => [...prev, userMsg, assistantMsg]);
        setInput("");
        const currentFile = file;
        clearFile();
        setIsLoading(true);

        try {
            let response: Response;

            if (currentFile) {
                const formData = new FormData();
                formData.append("message", userMsg.content);
                formData.append("history", JSON.stringify(buildHistory()));
                formData.append("file", currentFile);
                response = await fetch(`${API_BASE}/chat-with-file`, {
                    method: "POST",
                    body: formData,
                });
            } else {
                response = await fetch(`${API_BASE}/chat`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        messages: [...buildHistory(), { role: "user", content: userMsg.content }],
                        stream: true,
                    }),
                });
            }

            if (!response.ok) {
                throw new Error(`Server error: ${response.status}`);
            }

            const reader = response.body!.getReader();
            const decoder = new TextDecoder();
            let buffer = "";

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });

                const lines = buffer.split("\n");
                buffer = lines.pop() || "";

                for (const line of lines) {
                    if (line.startsWith("data: ")) {
                        const data = line.slice(6);
                        if (data === "[DONE]") break;
                        try {
                            const parsed = JSON.parse(data);
                            if (parsed.content) {
                                setMessages((prev) =>
                                    prev.map((m) =>
                                        m.id === assistantId
                                            ? { ...m, content: m.content + parsed.content, isStreaming: true }
                                            : m
                                    )
                                );
                            }
                        } catch { }
                    }
                }
            }

            setMessages((prev) =>
                prev.map((m) => (m.id === assistantId ? { ...m, isStreaming: false } : m))
            );
        } catch (err: any) {
            setMessages((prev) =>
                prev.map((m) =>
                    m.id === assistantId
                        ? {
                            ...m,
                            content: `❌ **Error:** ${err.message || "Something went wrong. Please check your backend is running."}`,
                            isStreaming: false,
                        }
                        : m
                )
            );
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    const clearChat = () => {
        setMessages([
            {
                id: uid(),
                role: "assistant",
                content: "Chat cleared! I'm ready for a fresh start. What would you like to learn about? 🚀",
            },
        ]);
    };

    const suggestions = [
        "Explain quantum entanglement simply",
        "What is the water cycle?",
        "Help me understand recursion",
        "Summarize the French Revolution",
    ];

    return (
        <div className="app" onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }} onDragLeave={() => setIsDragging(false)} onDrop={onDrop}>
            {isDragging && (
                <div className="drop-overlay">
                    <div className="drop-zone-inner">
                        <span className="drop-icon">📂</span>
                        <p>Drop your file here</p>
                    </div>
                </div>
            )}

            {/* Sidebar */}
            <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
                <div className="sidebar-header">
                    <div className="logo-mark">✦</div>
                    <span className="sidebar-title">StudyAI</span>
                </div>
                <nav className="sidebar-nav">
                    <button className="nav-item active">
                        <span>💬</span> Chat
                    </button>
                    <button className="nav-item" onClick={clearChat}>
                        <span>✨</span> New Chat
                    </button>
                </nav>
                <div className="sidebar-section">
                    <p className="sidebar-label">Capabilities</p>
                    <div className="cap-list">
                        <div className="cap-item"><span>📄</span> PDF Analysis</div>
                        <div className="cap-item"><span>🖼️</span> Image Vision</div>
                        <div className="cap-item"><span>🧠</span> Concept Explanations</div>
                        <div className="cap-item"><span>⚡</span> Streaming Responses</div>
                    </div>
                </div>
                <div className="sidebar-footer">
                    <p>Powered by Groq + Llama</p>
                </div>
            </aside>

            {/* Main */}
            <main className="main">
                {/* Top bar */}
                <header className="topbar">
                    <button className="menu-btn" onClick={() => setSidebarOpen((v) => !v)}>
                        <span /><span /><span />
                    </button>
                    <div className="topbar-title">
                        <div className="logo-dot" />
                        Student AI Assistant
                    </div>
                    <button className="clear-btn" onClick={clearChat} title="Clear chat">
                        🗑️
                    </button>
                </header>

                {/* Messages */}
                <div className="messages-container">
                    <div className="messages-inner">
                        {messages.map((msg) => (
                            <div key={msg.id} className={`message-row ${msg.role}`}>
                                <div className={`avatar ${msg.role}`}>
                                    {msg.role === "assistant" ? "✦" : "👤"}
                                </div>
                                <div className="bubble-wrap">
                                    {msg.file && <FilePreview file={msg.file} />}
                                    <div className={`bubble ${msg.role}`}>
                                        {msg.role === "assistant" ? (
                                            msg.isStreaming && !msg.content ? (
                                                <TypingDots />
                                            ) : (
                                                <ReactMarkdown
                                                    remarkPlugins={[remarkGfm]}
                                                    components={{
                                                        code({ node, inline, className, children, ...props }: any) {
                                                            const match = /language-(\w+)/.exec(className || "");
                                                            return !inline && match ? (
                                                                <SyntaxHighlighter
                                                                    style={oneDark}
                                                                    language={match[1]}
                                                                    PreTag="div"
                                                                    {...props}
                                                                >
                                                                    {String(children).replace(/\n$/, "")}
                                                                </SyntaxHighlighter>
                                                            ) : (
                                                                <code className={className} {...props}>
                                                                    {children}
                                                                </code>
                                                            );
                                                        },
                                                    }}
                                                >
                                                    {msg.content}
                                                </ReactMarkdown>
                                            )
                                        ) : (
                                            <p>{msg.content}</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                        <div ref={bottomRef} />
                    </div>
                </div>

                {/* Suggestions (show when only 1 message) */}
                {messages.length === 1 && (
                    <div className="suggestions">
                        {suggestions.map((s) => (
                            <button
                                key={s}
                                className="suggestion-chip"
                                onClick={() => { setInput(s); inputRef.current?.focus(); }}
                            >
                                {s}
                            </button>
                        ))}
                    </div>
                )}

                {/* Input area */}
                <div className="input-area">
                    {file && (
                        <div className="file-preview-bar">
                            {filePreview ? (
                                <img src={filePreview} alt="preview" className="preview-thumb" />
                            ) : (
                                <span className="preview-icon">📄</span>
                            )}
                            <span className="preview-name">{file.name}</span>
                            <button className="remove-file" onClick={clearFile}>✕</button>
                        </div>
                    )}
                    <div className="input-box">
                        <button
                            className="attach-btn"
                            onClick={() => fileInputRef.current?.click()}
                            title="Attach PDF or Image"
                        >
                            📎
                        </button>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.txt,.py,.js,.ts,.md,.csv"
                            style={{ display: "none" }}
                            onChange={(e) => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }}
                        />
                        <textarea
                            ref={inputRef}
                            className="input-field"
                            placeholder={file ? "Ask something about this file..." : "Ask anything... (Shift+Enter for new line)"}
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            rows={1}
                        />
                        <button
                            className={`send-btn ${isLoading ? "loading" : ""}`}
                            onClick={sendMessage}
                            disabled={isLoading || (!input.trim() && !file)}
                        >
                            {isLoading ? <span className="spinner" /> : "↑"}
                        </button>
                    </div>
                    <p className="input-hint">Upload PDFs or images • Groq-powered responses</p>
                </div>
            </main>
        </div>
    );
}
