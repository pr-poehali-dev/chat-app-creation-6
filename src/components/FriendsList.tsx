import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import Icon from '@/components/ui/icon';

interface Contact {
  id: string;
  status: string;
  direction: string;
  user: {
    id: string;
    username: string;
    display_name: string;
    avatar_url?: string;
    is_online: boolean;
    last_seen?: string;
    agent_name?: string;
  };
}

export default function FriendsList() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [pending, setPending] = useState<Contact[]>([]);
  const [tab, setTab] = useState<'friends' | 'requests' | 'add'>('friends');
  const [searchQ, setSearchQ] = useState('');
  const [searchResults, setSearchResults] = useState<{ id: string; username: string; display_name: string; is_online: boolean }[]>([]);
  const [addUsername, setAddUsername] = useState('');
  const [addStatus, setAddStatus] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadContacts();
  }, []);

  async function loadContacts() {
    try {
      const [acc, pend] = await Promise.all([
        api.contacts.list('accepted'),
        api.contacts.list('pending'),
      ]);
      setContacts(acc.contacts || []);
      setPending((pend.contacts || []).filter((c: Contact) => c.direction === 'incoming'));
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

  async function addFriend() {
    if (!addUsername.trim()) return;
    setLoading(true); setAddStatus('');
    try {
      await api.contacts.add({ username: addUsername.trim() });
      setAddStatus('Заявка отправлена!');
      setAddUsername('');
    } catch (err: unknown) {
      setAddStatus(err instanceof Error ? err.message : 'Ошибка');
    } finally {
      setLoading(false);
    }
  }

  async function respond(id: string, action: 'accept' | 'reject') {
    try {
      await api.contacts.respond(id, action);
      await loadContacts();
    } catch (e) {
      console.error(e);
    }
  }

  function lastSeen(iso?: string) {
    if (!iso) return '';
    const d = new Date(iso);
    const diff = Date.now() - d.getTime();
    if (diff < 60000) return 'только что';
    if (diff < 3600000) return `${Math.floor(diff / 60000)} мин. назад`;
    if (diff < 86400000) return d.toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' });
    return d.toLocaleDateString('ru', { day: 'numeric', month: 'short' });
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h2 className="text-base font-semibold text-foreground">Контакты</h2>
        {pending.length > 0 && (
          <span className="px-2 py-0.5 rounded-full bg-primary text-primary-foreground text-xs font-medium">{pending.length}</span>
        )}
      </div>

      <div className="flex border-b border-border">
        {(['friends', 'requests', 'add'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 py-2.5 text-xs font-medium transition-colors ${tab === t ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground'}`}>
            {t === 'friends' ? 'Друзья' : t === 'requests' ? `Заявки${pending.length > 0 ? ` (${pending.length})` : ''}` : 'Добавить'}
          </button>
        ))}
      </div>

      {tab === 'friends' && (
        <div className="flex-1 overflow-y-auto">
          <div className="px-4 pt-3 pb-2">
            <input
              value={searchQ}
              onChange={e => search(e.target.value)}
              placeholder="Поиск среди друзей..."
              className="w-full bg-card border border-border rounded-xl px-3.5 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          {contacts.length === 0 && searchQ.length < 2 && (
            <div className="flex flex-col items-center justify-center mt-12 px-6 text-center">
              <div className="text-4xl mb-3">🤝</div>
              <p className="text-muted-foreground text-sm">Добавь первого друга через вкладку «Добавить»</p>
            </div>
          )}

          {(searchQ.length >= 2 ? searchResults : contacts.map(c => c.user)).map(u => (
            <div key={u.id} className="flex items-center gap-3 px-4 py-3 border-b border-border/40 hover:bg-muted/20 transition-colors">
              <div className="relative">
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-sm font-bold text-primary">
                  {u.display_name?.[0]?.toUpperCase() || '?'}
                </div>
                <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-background ${u.is_online ? 'bg-emerald-500' : 'bg-muted-foreground/40'}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">{u.display_name}</p>
                <p className="text-xs text-muted-foreground">
                  {u.is_online ? 'онлайн' : lastSeen((u as Contact['user']).last_seen)}
                </p>
              </div>
              {'agent_name' in u && u.agent_name && (
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-xs">{u.agent_name}</span>
              )}
            </div>
          ))}
        </div>
      )}

      {tab === 'requests' && (
        <div className="flex-1 overflow-y-auto">
          {pending.length === 0 && (
            <div className="flex flex-col items-center justify-center mt-12 text-center px-6">
              <div className="text-4xl mb-3">📭</div>
              <p className="text-muted-foreground text-sm">Нет входящих заявок</p>
            </div>
          )}
          {pending.map(c => (
            <div key={c.id} className="flex items-center gap-3 px-4 py-3.5 border-b border-border/40">
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-sm font-bold text-primary flex-shrink-0">
                {c.user.display_name[0]?.toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">{c.user.display_name}</p>
                <p className="text-xs text-muted-foreground">@{c.user.username}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => respond(c.id, 'accept')}
                  className="px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 text-xs hover:bg-emerald-500/20 transition-colors">
                  Принять
                </button>
                <button onClick={() => respond(c.id, 'reject')}
                  className="px-3 py-1.5 rounded-lg bg-destructive/10 text-destructive text-xs hover:bg-destructive/20 transition-colors">
                  Отказать
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'add' && (
        <div className="flex-1 overflow-y-auto px-4 pt-4 space-y-4">
          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <p className="text-sm font-medium text-foreground">Добавить по имени пользователя</p>
            <div className="flex gap-2">
              <input
                value={addUsername}
                onChange={e => setAddUsername(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addFriend()}
                placeholder="@username"
                className="flex-1 bg-background border border-border rounded-xl px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              <button onClick={addFriend} disabled={loading || !addUsername.trim()}
                className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium disabled:opacity-40 hover:opacity-90 transition-opacity">
                {loading ? '...' : 'Добавить'}
              </button>
            </div>
            {addStatus && (
              <p className={`text-xs ${addStatus.includes('!') ? 'text-emerald-400' : 'text-destructive'}`}>{addStatus}</p>
            )}
          </div>

          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <p className="text-sm font-medium text-foreground">Поиск пользователей</p>
            <input
              value={searchQ}
              onChange={e => search(e.target.value)}
              placeholder="Введите имя или ник..."
              className="w-full bg-background border border-border rounded-xl px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
            />
            <div className="space-y-1">
              {searchResults.map(u => (
                <div key={u.id} className="flex items-center gap-3 py-2 border-b border-border/30">
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">
                    {u.display_name[0]?.toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-foreground">{u.display_name}</p>
                    <p className="text-xs text-muted-foreground">@{u.username}</p>
                  </div>
                  <button
                    onClick={() => { setAddUsername(u.username); setTab('add'); }}
                    className="px-2 py-1 rounded-lg bg-primary/10 text-primary text-xs hover:bg-primary/20 transition-colors">
                    <Icon name="UserPlus" size={12} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
