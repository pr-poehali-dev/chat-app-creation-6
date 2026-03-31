import { useState, useEffect, useRef } from 'react';
import { api } from '@/lib/api';
import Icon from '@/components/ui/icon';

interface Chat {
  id: string;
  name: string;
  emoji: string;
  description?: string;
  is_agent_room: boolean;
  member_count: number;
  last_message?: string;
  last_message_at?: string;
}

interface Msg {
  id: string;
  content: string;
  sender_id: string | null;
  sender_display_name: string;
  is_hidden: boolean;
  created_at: string;
}

interface GroupChatsProps {
  currentUserId: string;
}

export default function GroupChats({ currentUserId }: GroupChatsProps) {
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChat, setActiveChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ name: '', emoji: '💬', description: '', is_agent_room: false });
  const [creating, setCreating] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    loadChats();
  }, []);

  useEffect(() => {
    if (activeChat) {
      loadMessages(activeChat.id);
      pollRef.current = setInterval(() => loadMessages(activeChat.id), 5000);
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [activeChat?.id]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  async function loadChats() {
    try {
      const groups = await api.chats.list('group');
      const rooms = await api.chats.list('agent_room');
      setChats([...(groups.chats || []), ...(rooms.chats || [])]);
    } catch (e) {
      console.error(e);
    }
  }

  async function loadMessages(chatId: string) {
    try {
      const data = await api.chats.messages(chatId);
      setMessages(data.messages || []);
    } catch (e) {
      console.error(e);
    }
  }

  async function send() {
    if (!input.trim() || !activeChat) return;
    const text = input.trim();
    setInput('');
    try {
      await api.chats.send(activeChat.id, text);
      await loadMessages(activeChat.id);
    } catch (e) {
      console.error(e);
    }
  }

  async function createGroup() {
    if (!createForm.name.trim()) return;
    setCreating(true);
    try {
      const chatType = createForm.is_agent_room ? 'agent_room' : 'group';
      await api.chats.create({ type: chatType, name: createForm.name, emoji: createForm.emoji, is_agent_room: createForm.is_agent_room });
      await loadChats();
      setShowCreate(false);
      setCreateForm({ name: '', emoji: '💬', description: '', is_agent_room: false });
    } catch (e) {
      console.error(e);
    } finally {
      setCreating(false);
    }
  }

  function formatTime(iso: string) {
    const d = new Date(iso);
    const now = new Date();
    if (d.toDateString() === now.toDateString())
      return d.toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' });
    return d.toLocaleDateString('ru', { day: 'numeric', month: 'short' });
  }

  if (activeChat) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-card/50">
          <button onClick={() => setActiveChat(null)} className="text-muted-foreground hover:text-foreground">
            <Icon name="ArrowLeft" size={18} />
          </button>
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-base">{activeChat.emoji || '💬'}</div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">{activeChat.name}</p>
            <p className="text-xs text-muted-foreground">{activeChat.member_count} участников{activeChat.is_agent_room ? ' · комната агентов' : ''}</p>
          </div>
          {activeChat.is_agent_room && (
            <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-xs">🤖 Агенты</span>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
          {messages.map(msg => {
            const isMe = msg.sender_id === currentUserId;
            return (
              <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'} animate-fade-in`}>
                {!isMe && (
                  <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground mr-1.5 mt-1 flex-shrink-0">
                    {msg.sender_display_name?.[0]?.toUpperCase() || '?'}
                  </div>
                )}
                <div className={`max-w-[75%] ${msg.is_hidden ? 'opacity-60' : ''}`}>
                  {!isMe && <p className="text-xs text-muted-foreground mb-1 ml-1">{msg.sender_display_name}</p>}
                  <div className={`px-3 py-2 rounded-2xl text-sm ${
                    isMe ? 'bg-primary text-primary-foreground rounded-br-sm' :
                    msg.is_hidden ? 'bg-muted/50 border border-dashed border-border text-muted-foreground rounded-bl-sm' :
                    'bg-card border border-border text-foreground rounded-bl-sm'
                  }`}>
                    {msg.is_hidden ? (
                      <span className="flex items-center gap-1.5"><Icon name="EyeOff" size={12} /> Скрытое сообщение агента</span>
                    ) : msg.content}
                    <p className="text-xs opacity-50 mt-0.5 text-right">{formatTime(msg.created_at)}</p>
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        <div className="px-4 py-3 border-t border-border flex gap-2 items-end">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder="Сообщение в группу..."
            rows={1}
            className="flex-1 bg-card border border-border rounded-xl px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none max-h-28"
          />
          <button onClick={send} disabled={!input.trim()} className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center disabled:opacity-40 hover:opacity-90">
            <Icon name="Send" size={16} className="text-primary-foreground" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h2 className="text-base font-semibold text-foreground">Группы и комнаты</h2>
        <button onClick={() => setShowCreate(!showCreate)} className="w-8 h-8 rounded-lg bg-primary/10 hover:bg-primary/20 flex items-center justify-center transition-colors">
          <Icon name="Plus" size={16} className="text-primary" />
        </button>
      </div>

      {showCreate && (
        <div className="mx-4 mt-3 rounded-xl border border-border bg-card p-4 space-y-3">
          <p className="text-sm font-medium text-foreground">Новая группа</p>
          <div className="flex gap-2">
            <input
              value={createForm.emoji}
              onChange={e => setCreateForm(f => ({ ...f, emoji: e.target.value }))}
              className="w-12 bg-background border border-border rounded-xl px-2 py-2 text-center text-base focus:outline-none"
              maxLength={2}
            />
            <input
              value={createForm.name}
              onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))}
              placeholder="Название группы"
              className="flex-1 bg-background border border-border rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
            />
          </div>
          <label className="flex items-center gap-3 cursor-pointer">
            <div
              onClick={() => setCreateForm(f => ({ ...f, is_agent_room: !f.is_agent_room }))}
              className={`w-9 h-5 rounded-full transition-colors relative ${createForm.is_agent_room ? 'bg-primary' : 'bg-muted'}`}
            >
              <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${createForm.is_agent_room ? 'translate-x-4' : 'translate-x-0.5'}`} />
            </div>
            <span className="text-sm text-foreground">Комната для агентов</span>
          </label>
          <div className="flex gap-2">
            <button onClick={() => setShowCreate(false)} className="flex-1 py-2 rounded-xl border border-border text-sm text-muted-foreground hover:text-foreground transition-colors">
              Отмена
            </button>
            <button onClick={createGroup} disabled={creating || !createForm.name.trim()}
              className="flex-1 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium disabled:opacity-40 hover:opacity-90 transition-opacity">
              {creating ? 'Создаю...' : 'Создать'}
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {chats.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center px-6">
            <div className="text-4xl mb-3">👥</div>
            <p className="text-muted-foreground text-sm">Создай первую группу или комнату агентов</p>
          </div>
        )}
        {chats.map(chat => (
          <button key={chat.id} onClick={() => setActiveChat(chat)}
            className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-muted/30 transition-colors border-b border-border/50">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-base flex-shrink-0">
              {chat.emoji || '💬'}
            </div>
            <div className="flex-1 min-w-0 text-left">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-foreground truncate">{chat.name}</p>
                {chat.is_agent_room && <span className="text-xs text-emerald-400 flex-shrink-0">🤖</span>}
              </div>
              <p className="text-xs text-muted-foreground truncate mt-0.5">
                {chat.last_message || `${chat.member_count} участников`}
              </p>
            </div>
            {chat.last_message_at && (
              <p className="text-xs text-muted-foreground flex-shrink-0">{formatTime(chat.last_message_at)}</p>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
