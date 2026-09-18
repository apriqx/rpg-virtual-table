import { useState, useEffect, useRef, useCallback } from 'react';
import api from '../services/api';
import { onSocket } from '../services/socket';

function formatTime(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function highlightDice(text) {
  return text.replace(/\*\*(.*?)\*\*/g, '<strong style="color:#f1fa8c">$1</strong>');
}

export default function ChatPanel({ tableId, userId, username, isMaster, isMuted, whisperTarget, onWhisperDone }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [msgType, setMsgType] = useState('normal');
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const scrollRef = useRef(null);
  const scrollRestore = useRef(null);
  const lastCount = useRef(0);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    api.chat.getMessages(tableId).then((d) => {
      const list = Array.isArray(d) ? d : [];
      setMessages(list);
      setHasMore(list.length >= 100);
    }).catch(() => {});
  }, [tableId]);

  async function loadOlder() {
    if (loadingMore || messages.length === 0) return;
    setLoadingMore(true);
    const el = scrollRef.current;
    if (el) scrollRestore.current = { top: el.scrollTop, height: el.scrollHeight };
    try {
      const older = await api.chat.getMessages(tableId, messages[0].createdAt);
      const list = Array.isArray(older) ? older : [];
      setHasMore(list.length >= 100);
      setMessages((prev) => [...list.filter((o) => !prev.some((p) => p.id === o.id)), ...prev]);
    } catch {}
    setLoadingMore(false);
  }

  useEffect(() => {
    const append = ({ message }) => {
      if (!message) return;
      setMessages((prev) => (prev.some((m) => m.id === message.id) ? prev : [...prev, message]));
    };
    const offs = [
      onSocket('chat:message', append),
      onSocket('chat:whisper', append),
      onSocket('chat:cleared', () => { setMessages([]); setHasMore(false); }),
    ];
    return () => offs.forEach((off) => off());
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (scrollRestore.current && el) {
      const r = scrollRestore.current;
      scrollRestore.current = null;
      el.scrollTop = r.top + (el.scrollHeight - r.height);
    } else if (messages.length !== lastCount.current && messages.length > lastCount.current) {
      scrollToBottom();
    }
    lastCount.current = messages.length;
  }, [messages, scrollToBottom]);

  useEffect(() => {
    if (whisperTarget) {
      setInput('/w ' + whisperTarget + ' ');
      onWhisperDone?.();
      setTimeout(() => inputRef.current && inputRef.current.focus(), 50);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [whisperTarget]);

  const handleSend = async () => {
    if (isMuted) return;
    const text = input.trim();
    if (!text) return;
    setInput('');
    try {
      if (text.startsWith('/r ')) {
        await api.chat.send(tableId, { type: 'dice', text });
      } else if (text.startsWith('/narracao ')) {
        await api.chat.send(tableId, { type: 'narrative', text });
      } else if (text.startsWith('/w ')) {
        await api.chat.send(tableId, { type: 'player', text });
      } else {
        await api.chat.send(tableId, { type: msgType, text });
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  function getMessageClass(msg) {
    if (msg.type === 'system') return 'chat-msg-system';
    if (msg.type === 'dice') return 'chat-msg-dice';
    if (msg.type === 'narrative') return 'chat-msg-narrative';
    if (msg.whisperTo) return 'chat-msg-whisper';
    if (msg.type === 'master') return 'chat-msg-master';
    return 'chat-msg-player';
  }

  function getSenderLabel(msg) {
    if (msg.type === 'system') return '';
    if (msg.whisperTo) return `${msg.username} → sussurro`;
    if (msg.type === 'master') return `[Mestre] ${msg.username}`;
    if (msg.type === 'dice') return msg.username;
    return msg.username;
  }

  return (
    <div className="chat-panel">
      <div className="chat-messages" ref={scrollRef}>
        {hasMore && messages.length > 0 && (
          <button type="button" className="chat-load-more" onClick={loadOlder} disabled={loadingMore}>
            {loadingMore ? 'Carregando...' : '↑ Carregar mensagens antigas'}
          </button>
        )}
        {messages.map((msg) => {
          const isWhisperVisible = !msg.whisperTo ||
            msg.userId === userId ||
            msg.whisperTo === userId;
          if (!isWhisperVisible) return null;
          return (
            <div key={msg.id} className={`chat-msg ${getMessageClass(msg)}`}>
              {msg.type !== 'system' && (
                <span className="chat-sender">{getSenderLabel(msg)}</span>
              )}
              <span className="chat-time">{formatTime(msg.createdAt)}</span>
              <div
                className="chat-text"
                dangerouslySetInnerHTML={{
                  __html: msg.type === 'dice' ? highlightDice(msg.text) : msg.text,
                }}
              />
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>
      <div className="chat-input-area">
        <div className="chat-type-selector">
          {isMaster && (
            <button
              className={`chat-type-btn ${msgType === 'narrative' ? 'active' : ''}`}
              onClick={() => setMsgType(msgType === 'narrative' ? 'normal' : 'narrative')}
              title="Narracao (tambem /narracao texto)"
            >
              N
            </button>
          )}
          <button
            className={`chat-type-btn ${msgType === 'normal' ? 'active' : ''}`}
            onClick={() => setMsgType('normal')}
          >
            Fala
          </button>
        </div>
        <div className="chat-input-row">
          {isMuted && <div className="chat-muted-notice">🔇 Voce foi silenciado pelo Mestre</div>}
          <input
            ref={inputRef}
            className="chat-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isMuted}
            placeholder={isMuted ? 'Silenciado pelo Mestre...' : 'Mensagem... (/r 1d20 para dados, /w user para sussurro)'}
          />
          <button className="btn btn-primary chat-send-btn" onClick={handleSend} disabled={isMuted}>
            →
          </button>
        </div>
      </div>
    </div>
  );
}