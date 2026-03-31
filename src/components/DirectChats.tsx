import { useState, useEffect, useRef } from 'react';
import { api } from '@/lib/api';
import Icon from '@/components/ui/icon';

interface Chat {
  id: string;
  type: string;
  name: string;
  emoji?: string;
  last_message?: string;
  last_message_at?: string;
  member_count: number;
}

interface Msg {
  id: string;
  content: string;
  sender_id: string | null;
  sender_display_name: string;
  created_at: string;
  message_type: string;
}

interface DirectChatsProps {
  currentUserId: string;
}

export default function DirectChats({ currentUserId }: DirectChatsProps) {
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChat, setActiveChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [searchQ, setSearchQ] = useState('');
  const [searchResults, setSearchResults] = useState<{ id: string; username: string; display_name: string }[]>([]);
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
      const data = await api.chats.list('direct');
      setChats(data.chats || []);
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

  async function search(q: string) {
    setSearchQ(q);
    if (q.length < 2) { setSearchResults([]); return; }
    try {
      const data = await api.contacts.search(q);
      setSearchResults(data.users || []);
    } catch (e) {
      console.error(e);
    }
  }

  async function startChat(userId: string) {
    setLoading(true);
    try {
      const data = await api.chats.create({ type: 'direct', members: [userId] });
      await loadChats();
      setShowAdd(false);
      const upd = await api.chats.list('direct');
      const found = (upd.chats || []).find((c: Chat) => c.id === data.chat_id);
      if (found) setActiveChat(found);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
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
          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-sm font-bold text-primary">
            {activeChat.name?.[0]?.toUpperCase() || '?'}
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-foreground">{activeChat.name}</p>
          </div>
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
                <div className={`max-w-[75%] px-3 py-2 rounded-2xl text-sm ${
                  isMe ? 'bg-primary text-primary-foreground rounded-br-sm' : 'bg-card border border-border text-foreground rounded-bl-sm'
                }`}>
                  <p className="leading-relaxed">{msg.content}</p>
                  <p className="text-xs opacity-50 mt-0.5 text-right">{formatTime(msg.created_at)}</p>
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
            placeholder="Сообщение..."
            rows={1}
            className="flex-1 bg-card border border-border rounded-xl px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none max-h-28"
          />
          <button onClick={send} disabled={!input.trim()} className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center disabled:opacity-40 hover:opacity-90 transition-opacity">
            <Icon name="Send" size={16} className="text-primary-foreground" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h2 className="text-base font-semibold text-foreground">Сообщения</h2>
        <button onClick={() => setShowAdd(!showAdd)} className="w-8 h-8 rounded-lg bg-primary/10 hover:bg-primary/20 flex items-center justify-center transition-colors">
          <Icon name="Plus" size={16} className="text-primary" />
        </button>
      </div>

      {showAdd && (
        <div className="mx-4 mt-3 rounded-xl border border-border bg-card overflow-hidden">
          <div className="p-3 border-b border-border">
            <input
              value={searchQ}
              onChange={e => search(e.target.value)}
              placeholder="Найти пользователя..."
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
            />
          </div>
          <div className="max-h-40 overflow-y-auto">
            {searchResults.length === 0 && searchQ.length >= 2 && (
              <p className="text-xs text-muted-foreground p-3">Не найдено</p>
            )}
            {searchResults.map(u => (
              <button key={u.id} onClick={() => startChat(u.id)} disabled={loading}
                className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-muted/50 transition-colors">
                <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">
                  {u.display_name[0]?.toUpperCase()}
                </div>
                <div className="text-left">
                  <p className="text-sm text-foreground">{u.display_name}</p>
                  <p className="text-xs text-muted-foreground">@{u.username}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {chats.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center px-6">
            <div className="text-4xl mb-3">💬</div>
            <p className="text-muted-foreground text-sm">Нет сообщений. Найди друга и начни общаться!</p>
          </div>
        )}
        {chats.map(chat => (
          <button key={chat.id} onClick={() => setActiveChat(chat)}
            className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-muted/30 transition-colors border-b border-border/50">
            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-base font-bold text-primary flex-shrink-0">
              {chat.name?.[0]?.toUpperCase() || '?'}
            </div>
            <div className="flex-1 min-w-0 text-left">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-foreground truncate">{chat.name}</p>
                {chat.last_message_at && (
                  <p className="text-xs text-muted-foreground ml-2 flex-shrink-0">{formatTime(chat.last_message_at)}</p>
                )}
              </div>
              <p className="text-xs text-muted-foreground truncate mt-0.5">{chat.last_message || 'Нет сообщений'}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
