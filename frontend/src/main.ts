/**
 * frontend/src/main.ts
 * AI Student Assistant — complete chat UI logic (v2)
 */

import './style.css';

// ─────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────
const API_BASE = 'http://localhost:8000';

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────
interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  tool_used?: string | null;
  sources?: string | null;
  timestamp: Date;
}

interface ChatResponse {
  reply: string;
  tool_used?: string | null;
  sources?: string | null;
}

interface HistoryItem {
  role: string;
  content: string;
}

// ─────────────────────────────────────────────
// STATE
// ─────────────────────────────────────────────
let messages: ChatMessage[] = [];
let isLoading = false;
let sidebarOpen = false;
let msgIdCounter = 0;

function nextId(): string {
  return `msg-${++msgIdCounter}`;
}

// ─────────────────────────────────────────────
// UTILITIES
// ─────────────────────────────────────────────
function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Lightweight markdown renderer:
 * fenced code blocks, inline code, headers, bold, italic, lists, line breaks.
 */
function renderMarkdown(raw: string): string {
  // Work on raw (not html-escaped) so we can wrap in html tags safely.
  // Strategy: split into code-block segments and non-code segments.
  const parts: string[] = [];
  const fence = /```([\w]*)\n?([\s\S]*?)```/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = fence.exec(raw)) !== null) {
    // Process text before this code fence
    if (match.index > lastIndex) {
      parts.push(formatInlineMarkdown(raw.slice(lastIndex, match.index)));
    }
    const code = escapeHtml(match[2]);
    parts.push(
      `<div class="code-block-wrapper">` +
      `<button class="copy-code-btn" data-code="${encodeURIComponent(match[2])}">Copy</button>` +
      `<pre><code>${code}</code></pre>` +
      `</div>`
    );
    lastIndex = match.index + match[0].length;
  }

  // Remaining text after last fence
  if (lastIndex < raw.length) {
    parts.push(formatInlineMarkdown(raw.slice(lastIndex)));
  }

  return parts.join('');
}

function formatInlineMarkdown(text: string): string {
  let html = '';
  // Split by double-newlines for paragraph-like separation
  const paragraphs = text.split(/\n{2,}/);

  html = paragraphs.map((para) => {
    // Unordered list block
    const listLines = para.split('\n');
    const allListItems = listLines.every(l => /^\s*[\*\-] /.test(l.trim()) || l.trim() === '');
    if (allListItems && listLines.some(l => /^\s*[\*\-] /.test(l.trim()))) {
      const items = listLines
        .filter(l => /^\s*[\*\-] /.test(l.trim()))
        .map(l => `<li>${inlineFormat(l.replace(/^\s*[\*\-] /, ''))}</li>`)
        .join('');
      return `<ul>${items}</ul>`;
    }

    // Ordered list block
    const allOrdered = listLines.every(l => /^\s*\d+\. /.test(l.trim()) || l.trim() === '');
    if (allOrdered && listLines.some(l => /^\s*\d+\. /.test(l.trim()))) {
      const items = listLines
        .filter(l => /^\s*\d+\. /.test(l.trim()))
        .map(l => `<li>${inlineFormat(l.replace(/^\s*\d+\. /, ''))}</li>`)
        .join('');
      return `<ol>${items}</ol>`;
    }

    // Headers
    if (/^### /.test(para.trim())) return `<h3>${inlineFormat(para.trim().slice(4))}</h3>`;
    if (/^## /.test(para.trim())) return `<h2>${inlineFormat(para.trim().slice(3))}</h2>`;
    if (/^# /.test(para.trim())) return `<h1>${inlineFormat(para.trim().slice(2))}</h1>`;

    // Fallback: normal lines joined with <br>
    const lines = para.split('\n').map(l => inlineFormat(l)).join('<br>');
    return `<p>${lines}</p>`;
  }).join('');

  return html;
}

function inlineFormat(text: string): string {
  let s = escapeHtml(text);
  // Inline code (must come before bold/italic)
  s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
  // Bold + italic
  s = s.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  // Bold
  s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  // Italic
  s = s.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<em>$1</em>');
  return s;
}

function getToolLabel(tool: string): string {
  switch (tool) {
    case 'calculator': return '🧮 Calculator';
    case 'web_search': return '🔍 Web Search';
    default: return '🤖 AI';
  }
}

function getToolClass(tool: string): string {
  if (tool === 'calculator') return 'calculator';
  if (tool === 'web_search') return 'web_search';
  return 'llm';
}

// ─────────────────────────────────────────────
// TOAST
// ─────────────────────────────────────────────
function showToast(message: string, type: 'success' | 'error' | 'info' = 'info', duration = 3500) {
  const container = document.getElementById('toast-container')!;
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// ─────────────────────────────────────────────
// RENDER
// ─────────────────────────────────────────────
function renderEmptyState(): string {
  return `
    <div class="empty-state" id="empty-state">
      <div class="empty-hero">🎓</div>
      <h1 class="empty-title">How can I help you study?</h1>
      <p class="empty-subtitle">
        Ask me anything — from explaining concepts and solving problems,
        to web research and calculations. I&apos;m here to help you learn smarter.
      </p>
      <div class="suggestion-grid">
        <button class="suggestion-card" data-suggestion="Explain the difference between machine learning and deep learning" id="sug-1">
          <span class="s-icon">🧠</span>
          <span class="s-title">Explain a concept</span>
          <span class="s-text">ML vs Deep Learning</span>
        </button>
        <button class="suggestion-card" data-suggestion="Calculate the value of sin(45) + cos(30) and explain the steps" id="sug-2">
          <span class="s-icon">🧮</span>
          <span class="s-title">Math calculation</span>
          <span class="s-text">Trigonometry computation</span>
        </button>
        <button class="suggestion-card" data-suggestion="Search for the latest advances in quantum computing in 2025" id="sug-3">
          <span class="s-icon">🔍</span>
          <span class="s-title">Web research</span>
          <span class="s-text">Quantum computing advances</span>
        </button>
        <button class="suggestion-card" data-suggestion="Summarize the key principles of Newton's laws of motion with examples" id="sug-4">
          <span class="s-icon">📚</span>
          <span class="s-title">Summarize topic</span>
          <span class="s-text">Newton's laws of motion</span>
        </button>
      </div>
    </div>
  `;
}

function renderMessage(msg: ChatMessage): string {
  const isUser = msg.role === 'user';
  const rowClass = isUser ? 'user-row' : 'ai-row';
  const avatarClass = isUser ? 'user-av' : 'ai-av';
  const avatarEmoji = isUser ? '👤' : '🤖';

  const toolBadge = (!isUser && msg.tool_used)
    ? `<span class="tool-badge ${getToolClass(msg.tool_used)}">${getToolLabel(msg.tool_used)}</span>`
    : '';

  const sourcesBox = (!isUser && msg.sources)
    ? `<div class="sources-box"><strong>📎 Sources:</strong> ${escapeHtml(msg.sources)}</div>`
    : '';

  const bubbleContent = isUser
    ? `<p>${escapeHtml(msg.content)}</p>`
    : renderMarkdown(msg.content);

  return `
    <div class="message-row ${rowClass}" id="${msg.id}">
      <div class="msg-avatar ${avatarClass}">${avatarEmoji}</div>
      <div class="msg-content">
        ${toolBadge}
        <div class="msg-bubble">${bubbleContent}</div>
        ${sourcesBox}
        <span class="msg-time">${formatTime(msg.timestamp)}</span>
      </div>
    </div>
  `;
}

function renderTypingIndicator(): string {
  return `
    <div class="typing-indicator" id="typing-indicator">
      <div class="msg-avatar ai-av">🤖</div>
      <div class="typing-bubble">
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
      </div>
    </div>
  `;
}

function renderMessages() {
  const area = document.getElementById('messages-area')!;

  if (messages.length === 0) {
    area.innerHTML = renderEmptyState();
    attachSuggestionListeners();
    return;
  }

  area.innerHTML = messages.map(renderMessage).join('');
  attachCopyListeners();
  scrollToBottom();
}

/** Append a single new message without re-rendering all (smoother UX) */
function appendMessage(msg: ChatMessage) {
  const area = document.getElementById('messages-area')!;
  // Remove empty state if present
  const emptyState = document.getElementById('empty-state');
  if (emptyState) emptyState.remove();

  area.insertAdjacentHTML('beforeend', renderMessage(msg));
  attachCopyListeners();
  scrollToBottom();
}

function scrollToBottom() {
  const area = document.getElementById('messages-area')!;
  area.scrollTo({ top: area.scrollHeight, behavior: 'smooth' });
}

// ─────────────────────────────────────────────
// COPY CODE BUTTON
// ─────────────────────────────────────────────
function attachCopyListeners() {
  document.querySelectorAll<HTMLButtonElement>('.copy-code-btn').forEach((btn) => {
    if (btn.dataset.attached) return;
    btn.dataset.attached = '1';
    btn.addEventListener('click', () => {
      const code = decodeURIComponent(btn.dataset.code || '');
      navigator.clipboard.writeText(code).then(() => {
        btn.textContent = 'Copied!';
        btn.classList.add('copied');
        setTimeout(() => {
          btn.textContent = 'Copy';
          btn.classList.remove('copied');
        }, 2000);
      });
    });
  });
}

// ─────────────────────────────────────────────
// API CALLS
// ─────────────────────────────────────────────
async function sendMessage(text: string) {
  if (isLoading || !text.trim()) return;

  const userMsg: ChatMessage = {
    id: nextId(),
    role: 'user',
    content: text.trim(),
    timestamp: new Date(),
  };
  messages.push(userMsg);
  isLoading = true;

  appendMessage(userMsg);
  showTypingIndicator();
  setInputDisabled(true);
  setSendLoading(true);

  try {
    const resp = await fetch(`${API_BASE}/chat/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text.trim() }),
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({ detail: 'Unknown error' }));
      throw new Error(err.detail || `HTTP ${resp.status}`);
    }

    const data: ChatResponse = await resp.json();
    const aiMsg: ChatMessage = {
      id: nextId(),
      role: 'assistant',
      content: data.reply,
      tool_used: data.tool_used,
      sources: data.sources,
      timestamp: new Date(),
    };
    messages.push(aiMsg);
    hideTypingIndicator();
    appendMessage(aiMsg);
  } catch (err: any) {
    hideTypingIndicator();
    const errMsg: ChatMessage = {
      id: nextId(),
      role: 'assistant',
      content: `**Error:** ${err.message || 'Failed to connect to the AI backend. Please ensure the server is running on port 8000.'}`,
      timestamp: new Date(),
    };
    messages.push(errMsg);
    appendMessage(errMsg);
    showToast('Failed to get a response. Check the backend server.', 'error');
  } finally {
    isLoading = false;
    setInputDisabled(false);
    setSendLoading(false);
    focusInput();
  }
}

async function loadHistory() {
  try {
    const resp = await fetch(`${API_BASE}/chat/history`);
    if (!resp.ok) return;
    const data = await resp.json();
    const history: HistoryItem[] = data.history || [];
    messages = history.map((item) => ({
      id: nextId(),
      role: item.role as 'user' | 'assistant',
      content: item.content,
      timestamp: new Date(),
    }));
    renderMessages();
    if (messages.length > 0) {
      showToast(`Loaded ${messages.length} previous messages`, 'success', 2500);
    } else {
      showToast('No previous history found', 'info', 2000);
    }
  } catch {
    showToast('Backend not reachable', 'error');
  }
}

async function clearHistory() {
  try {
    const resp = await fetch(`${API_BASE}/chat/history`, { method: 'DELETE' });
    if (!resp.ok) throw new Error('Server error');
    messages = [];
    renderMessages();
    showToast('Chat history cleared', 'success');
  } catch {
    showToast('Failed to clear history', 'error');
  }
}

// ─────────────────────────────────────────────
// UI HELPERS
// ─────────────────────────────────────────────
function showTypingIndicator() {
  const area = document.getElementById('messages-area')!;
  const existing = document.getElementById('typing-indicator');
  if (!existing) {
    area.insertAdjacentHTML('beforeend', renderTypingIndicator());
    scrollToBottom();
  }
}

function hideTypingIndicator() {
  document.getElementById('typing-indicator')?.remove();
}

function setInputDisabled(disabled: boolean) {
  const input = document.getElementById('message-input') as HTMLTextAreaElement;
  if (input) input.disabled = disabled;
}

function setSendLoading(loading: boolean) {
  const btn = document.getElementById('send-btn') as HTMLButtonElement;
  if (!btn) return;
  btn.disabled = loading;
  btn.innerHTML = loading
    ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>`
    : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>`;
  if (loading) btn.classList.add('loading');
  else btn.classList.remove('loading');
}

function focusInput() {
  (document.getElementById('message-input') as HTMLTextAreaElement)?.focus();
}

function autoresizeTextarea(el: HTMLTextAreaElement) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 148) + 'px';
}

function attachSuggestionListeners() {
  document.querySelectorAll<HTMLButtonElement>('.suggestion-card').forEach((card) => {
    card.addEventListener('click', () => {
      const suggestion = card.dataset.suggestion;
      if (suggestion) {
        const input = document.getElementById('message-input') as HTMLTextAreaElement;
        input.value = suggestion;
        autoresizeTextarea(input);
        handleSend();
      }
    });
  });
}

// ─────────────────────────────────────────────
// MODAL
// ─────────────────────────────────────────────
function showClearModal() {
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.id = 'clear-modal';
  backdrop.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div class="modal-icon">🗑️</div>
      <h3 id="modal-title">Clear Chat History?</h3>
      <p>This will permanently delete all messages from the AI's memory. This action cannot be undone.</p>
      <div class="modal-actions">
        <button class="modal-btn cancel" id="modal-cancel">Cancel</button>
        <button class="modal-btn confirm" id="modal-confirm">Clear History</button>
      </div>
    </div>
  `;
  document.body.appendChild(backdrop);

  document.getElementById('modal-cancel')!.addEventListener('click', () => backdrop.remove());
  document.getElementById('modal-confirm')!.addEventListener('click', () => {
    backdrop.remove();
    clearHistory();
  });
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) backdrop.remove();
  });
  // Close on Escape
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') { backdrop.remove(); document.removeEventListener('keydown', onKey); }
  };
  document.addEventListener('keydown', onKey);
}

// ─────────────────────────────────────────────
// HANDLE SEND
// ─────────────────────────────────────────────
function handleSend() {
  const input = document.getElementById('message-input') as HTMLTextAreaElement;
  const text = input.value.trim();
  if (!text || isLoading) return;
  input.value = '';
  autoresizeTextarea(input);
  sendMessage(text);
}

// ─────────────────────────────────────────────
// BUILD APP HTML
// ─────────────────────────────────────────────
function buildApp() {
  document.getElementById('app')!.innerHTML = `
    <!-- Toast container -->
    <div id="toast-container"></div>

    <div class="app-shell">
      <!-- ────── SIDEBAR ────── -->
      <aside class="sidebar" id="sidebar" role="complementary" aria-label="Navigation">
        <div class="sidebar-logo">
          <div class="logo-icon">🎓</div>
          <div>
            <h2>StudyAI</h2>
            <span>AI Powered</span>
          </div>
        </div>

        <div class="sidebar-section">
          <button class="new-chat-btn" id="new-chat-btn" aria-label="Start new chat">
            <span class="icon">✏️</span>
            New Chat
          </button>
        </div>

        <div class="sidebar-section">
          <p class="sidebar-section-label">Capabilities</p>
          <div class="capability-list">
            <div class="capability-item">
              <div class="cap-dot" style="background:#a78bfa; color:#a78bfa"></div>
              AI-powered Q&amp;A
            </div>
            <div class="capability-item">
              <div class="cap-dot" style="background:#f59e0b; color:#f59e0b"></div>
              Calculator tool
            </div>
            <div class="capability-item">
              <div class="cap-dot" style="background:#06b6d4; color:#06b6d4"></div>
              Web search
            </div>
            <div class="capability-item">
              <div class="cap-dot" style="background:#10b981; color:#10b981"></div>
              Persistent memory
            </div>
          </div>
        </div>

        <div class="sidebar-footer">
          <div class="status-pill" id="status-pill">
            <div class="dot"></div>
            <span id="status-text">Checking…</span>
          </div>
        </div>
      </aside>

      <!-- ────── MAIN ────── -->
      <main class="main-content" role="main">
        <!-- Header -->
        <header class="chat-header">
          <div class="header-left">
            <button class="sidebar-toggle" id="sidebar-toggle" aria-label="Toggle sidebar">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
              </svg>
            </button>
            <div class="header-ai-avatar">🤖</div>
            <div>
              <div class="header-title">AI Study Assistant</div>
              <div class="header-subtitle" id="header-status">Online</div>
            </div>
          </div>
          <div class="header-actions">
            <button class="icon-btn" id="history-btn" title="Load history" aria-label="Load chat history">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.51"/>
              </svg>
            </button>
            <button class="icon-btn danger" id="clear-btn" title="Clear history" aria-label="Clear chat history">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6m4-6v6"/><path d="M9 6V4h6v2"/>
              </svg>
            </button>
          </div>
        </header>

        <!-- Messages -->
        <div class="messages-area" id="messages-area" role="log" aria-live="polite" aria-label="Chat messages">
        </div>

        <!-- Input -->
        <div class="input-area">
          <div class="input-wrapper">
            <div class="input-container">
              <textarea
                id="message-input"
                placeholder="Ask anything — explain, calculate, research…"
                rows="1"
                aria-label="Message input"
                aria-multiline="true"
              ></textarea>
              <button class="send-btn" id="send-btn" aria-label="Send message">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
                </svg>
              </button>
            </div>
            <p class="input-hint">
              Press <kbd>Enter</kbd> to send &nbsp;·&nbsp; <kbd>Shift + Enter</kbd> for new line
              &nbsp;·&nbsp; Use "<em>calculate</em>" or "<em>search</em>" for tools
            </p>
          </div>
        </div>
      </main>
    </div>
  `;
}

// ─────────────────────────────────────────────
// BACKEND HEALTH CHECK
// ─────────────────────────────────────────────
async function checkHealth() {
  try {
    const resp = await fetch(`${API_BASE}/`, { signal: AbortSignal.timeout(4000) });
    setStatus(resp.ok);
  } catch {
    setStatus(false);
  }
}

function setStatus(online: boolean) {
  const dot = document.querySelector<HTMLDivElement>('.status-pill .dot');
  const text = document.getElementById('status-text');
  const headerStatus = document.getElementById('header-status');

  if (!dot || !text || !headerStatus) return;

  if (online) {
    dot.style.background = '#10b981';
    text.textContent = 'Backend connected';
    headerStatus.textContent = 'Online';
    headerStatus.style.color = '#10b981';
  } else {
    dot.style.background = '#ef4444';
    text.textContent = 'Backend offline';
    headerStatus.textContent = 'Offline';
    headerStatus.style.color = '#ef4444';
  }
}

// ─────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────
function init() {
  buildApp();
  renderMessages(); // show empty state

  const input = document.getElementById('message-input') as HTMLTextAreaElement;
  const sendBtn = document.getElementById('send-btn') as HTMLButtonElement;
  const clearBtn = document.getElementById('clear-btn') as HTMLButtonElement;
  const historyBtn = document.getElementById('history-btn') as HTMLButtonElement;
  const newChatBtn = document.getElementById('new-chat-btn') as HTMLButtonElement;
  const sidebarToggle = document.getElementById('sidebar-toggle') as HTMLButtonElement;
  const sidebar = document.getElementById('sidebar') as HTMLElement;

  // Textarea auto-resize + Enter handling
  input.addEventListener('input', () => autoresizeTextarea(input));
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  });

  // Send button
  sendBtn.addEventListener('click', handleSend);

  // Clear history modal
  clearBtn.addEventListener('click', showClearModal);

  // Load history
  historyBtn.addEventListener('click', () => {
    showToast('Loading conversation history…', 'info', 1800);
    loadHistory();
  });

  // New chat
  newChatBtn.addEventListener('click', () => {
    messages = [];
    msgIdCounter = 0;
    renderMessages();
    focusInput();
    if (window.innerWidth <= 768) {
      sidebar.classList.remove('open');
      sidebarOpen = false;
    }
  });

  // Sidebar toggle (mobile)
  sidebarToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    sidebarOpen = !sidebarOpen;
    sidebar.classList.toggle('open', sidebarOpen);
  });

  // Close sidebar when clicking outside on mobile
  document.addEventListener('click', (e) => {
    if (
      window.innerWidth <= 768 &&
      sidebarOpen &&
      !sidebar.contains(e.target as Node) &&
      e.target !== sidebarToggle
    ) {
      sidebarOpen = false;
      sidebar.classList.remove('open');
    }
  });

  // Backend health check
  checkHealth();
  setInterval(checkHealth, 30_000);

  // Focus input
  focusInput();
}

// Bootstrap
init();
