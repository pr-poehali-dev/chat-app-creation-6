import { useState, useRef, useEffect } from 'react';
import { api } from '@/lib/api';
import Icon from '@/components/ui/icon';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: string;
}

interface MemoryStats {
  events: number;
  generalizations: number;
  principles: number;
}

export default function AgentChat() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '0',
      role: 'assistant',
      text: 'Привет. Я — Пино. Как два дерева, растущие рядом, мы можем помогать друг другу тянуться к свету. О чём ты хочешь поговорить?',
      timestamp: new Date().toISOString(),
    }
  ]);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const [memoryStats, setMemoryStats] = useState<MemoryStats>({ events: 0, generalizations: 0, principles: 0 });
  const [memoryNote, setMemoryNote] = useState('');
  const [showMemory, setShowMemory] = useState(false);
  const [memories, setMemories] = useState<{ id: string; level: string; category: string; content: string; confidence: number }[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, typing]);

  useEffect(() => {
    api.agent.settings().catch(() => {});
    api.agent.memory().then(d => {
      setMemories(d.memories || []);
    }).catch(() => {});
  }, []);

  async function sendMessage() {
    const text = input.trim();
    if (!text || typing) return;

    const userMsg: Message = { id: Date.now().toString(), role: 'user', text, timestamp: new Date().toISOString() };
    const hist = messages.filter(m => m.role !== 'assistant' || m.id !== '0').map(m => ({ role: m.role, content: m.text }));

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setTyping(true);

    try {
      const res = await api.agent.chat(text, hist);
      const agentMsg: Message = { id: (Date.now() + 1).toString(), role: 'assistant', text: res.reply, timestamp: new Date().toISOString() };
      setMessages(prev => [...prev, agentMsg]);

      if (res.memory_stats) {
        const prev = memoryStats;
        const curr = res.memory_stats as MemoryStats;
        if (curr.events > prev.events || curr.generalizations > prev.generalizations || curr.principles > prev.principles) {
          setMemoryNote('Пино запомнил новое о тебе');
          setTimeout(() => setMemoryNote(''), 4000);
        }
        setMemoryStats(curr);
      }
    } catch (err: unknown) {
      const errMsg: Message = {
        id: (Date.now() + 1).toString(), role: 'assistant',
        text: `Что-то пошло не так: ${err instanceof Error ? err.message : 'ошибка'}. Проверь API-ключ в настройках профиля.`,
        timestamp: new Date().toISOString()
      };
      setMessages(prev => [...prev, errMsg]);
    } finally {
      setTyping(false);
    }
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  }

  function resetChat() {
    setMessages([{
      id: '0', role: 'assistant',
      text: 'Корни снова в земле. Я здесь, рядом. О чём поговорим?',
      timestamp: new Date().toISOString()
    }]);
  }

  async function loadMemory() {
    try {
      const d = await api.agent.memory();
      setMemories(d.memories || []);
      setShowMemory(true);
    } catch (e) {
      console.error(e);
    }
  }

  async function exportMemory() {
    try {
      const data = await api.agent.exportMemory();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = 'pino_memory.json'; a.click();
    } catch (e) {
      console.error(e);
    }
  }

  const levels = { principle: '🌳', generalization: '🌿', event: '🍃' };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card/50">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-9 h-9 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-lg">🌿</div>
            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-background animate-pulse-dot" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">Пино</p>
            <p className="text-xs text-muted-foreground">
              {memoryStats.events > 0 ? `${memoryStats.events} фактов · ${memoryStats.generalizations} обобщений` : 'цифровой друг'}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={loadMemory} className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors" title="Память">
            <Icon name="Brain" size={16} />
          </button>
          <button onClick={exportMemory} className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors" title="Экспорт памяти">
            <Icon name="Download" size={16} />
          </button>
          <button onClick={resetChat} className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors" title="Новый диалог">
            <Icon name="RotateCcw" size={16} />
          </button>
        </div>
      </div>

      {memoryNote && (
        <div className="mx-4 mt-2 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs animate-fade-in">
          🌱 {memoryNote}
        </div>
      )}

      {showMemory && (
        <div className="mx-4 mt-2 rounded-xl border border-border bg-card overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 border-b border-border">
            <span className="text-xs font-medium text-foreground">Архив памяти Пино</span>
            <button onClick={() => setShowMemory(false)} className="text-muted-foreground hover:text-foreground">
              <Icon name="X" size={14} />
            </button>
          </div>
          <div className="max-h-48 overflow-y-auto p-2 space-y-1">
            {memories.length === 0 && <p className="text-xs text-muted-foreground p-2">Пока пусто. Расскажи мне о себе.</p>}
            {memories.map(m => (
              <div key={m.id} className="flex items-start gap-2 px-2 py-1.5 rounded-lg hover:bg-muted/50 group">
                <span className="text-sm mt-0.5">{levels[m.level as keyof typeof levels] || '🍃'}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-foreground leading-relaxed">{m.content}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{m.category} · {Math.round(m.confidence * 100)}%</p>
                </div>
                <div className="hidden group-hover:flex gap-1">
                  <button onClick={() => api.agent.feedback(m.id, 'positive')} className="text-emerald-400 hover:text-emerald-300">
                    <Icon name="ThumbsUp" size={12} />
                  </button>
                  <button onClick={() => api.agent.feedback(m.id, 'negative')} className="text-red-400 hover:text-red-300">
                    <Icon name="ThumbsDown" size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 scrollbar-thin">
        {messages.map(msg => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`}>
            {msg.role === 'assistant' && (
              <div className="w-7 h-7 rounded-full bg-emerald-500/20 flex items-center justify-center text-sm mr-2 flex-shrink-0 mt-1">🌿</div>
            )}
            <div className={`max-w-[78%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
              msg.role === 'user'
                ? 'bg-primary text-primary-foreground rounded-br-sm'
                : 'bg-card border border-border text-foreground rounded-bl-sm'
            }`}>
              {msg.text}
              <p className="text-xs opacity-50 mt-1 text-right">
                {new Date(msg.timestamp).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
        ))}
        {typing && (
          <div className="flex items-end gap-2 animate-fade-in">
            <div className="w-7 h-7 rounded-full bg-emerald-500/20 flex items-center justify-center text-sm">🌿</div>
            <div className="bg-card border border-border px-4 py-3 rounded-2xl rounded-bl-sm">
              <div className="flex gap-1 items-center h-4">
                <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="px-4 py-3 border-t border-border">
        <div className="flex gap-2 items-end">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Напиши что-нибудь Пино..."
            rows={1}
            className="flex-1 bg-card border border-border rounded-xl px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none max-h-32 leading-relaxed"
            style={{ overflowY: input.split('\n').length > 3 ? 'auto' : 'hidden' }}
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || typing}
            className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center flex-shrink-0 disabled:opacity-40 hover:opacity-90 transition-opacity"
          >
            <Icon name="Send" size={16} className="text-primary-foreground" />
          </button>
        </div>
      </div>
    </div>
  );
}