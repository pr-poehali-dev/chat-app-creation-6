import { useState, useEffect } from 'react';
import { api, clearToken } from '@/lib/api';
import Icon from '@/components/ui/icon';

interface ProfileProps {
  onLogout: () => void;
}

interface UserData {
  id: string;
  username: string;
  display_name: string;
  email: string;
  avatar_url?: string;
  bio: string;
  city: string;
  age?: number;
  occupation: string;
  interests: string[];
  agent_name: string;
}

interface AgentSettings {
  agent_id: string;
  name: string;
  model_id: string;
  custom_endpoint: string;
  custom_model_name: string;
  has_api_key: boolean;
  is_pino: boolean;
}

const MODELS = [
  { id: 'deepseek-chat', label: 'DeepSeek V3', group: 'DeepSeek' },
  { id: 'deepseek-reasoner', label: 'DeepSeek R1', group: 'DeepSeek' },
  { id: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B', group: 'Groq (бесплатно)' },
  { id: 'mixtral-8x7b-32768', label: 'Mixtral 8x7B', group: 'Groq (бесплатно)' },
  { id: 'anthropic/claude-3.5-haiku', label: 'Claude 3.5 Haiku', group: 'OpenRouter' },
  { id: 'custom', label: 'Своя модель', group: 'Custom' },
];

export default function Profile({ onLogout }: ProfileProps) {
  const [tab, setTab] = useState<'profile' | 'agent' | 'memory'>('profile');
  const [user, setUser] = useState<UserData | null>(null);
  const [agentSettings, setAgentSettings] = useState<AgentSettings | null>(null);
  const [memories, setMemories] = useState<{ id: string; level: string; category: string; content: string; confidence: number }[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveOk, setSaveOk] = useState(false);

  const [profileForm, setProfileForm] = useState({ display_name: '', bio: '', city: '', occupation: '', agent_name: '' });
  const [agentForm, setAgentForm] = useState({ model_id: 'deepseek-chat', api_key: '', custom_endpoint: '', custom_model_name: '' });
  const [newInterest, setNewInterest] = useState('');
  const [interests, setInterests] = useState<string[]>([]);
  const [showKey, setShowKey] = useState(false);

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    try {
      const [me, settings, mem] = await Promise.all([
        api.auth.me(),
        api.agent.settings(),
        api.agent.memory(),
      ]);
      const u = me.user as UserData;
      setUser(u);
      setProfileForm({ display_name: u.display_name, bio: u.bio, city: u.city, occupation: u.occupation, agent_name: u.agent_name });
      setInterests(u.interests || []);

      const s = settings as AgentSettings;
      setAgentSettings(s);
      setAgentForm({ model_id: s.model_id, api_key: '', custom_endpoint: s.custom_endpoint, custom_model_name: s.custom_model_name });

      setMemories(mem.memories || []);
    } catch (e) {
      console.error(e);
    }
  }

  async function saveProfile() {
    setSaving(true); setSaveOk(false);
    try {
      await api.auth.update({ ...profileForm, interests });
      setSaveOk(true);
      setTimeout(() => setSaveOk(false), 3000);
      await loadAll();
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  }

  async function saveAgent() {
    setSaving(true); setSaveOk(false);
    try {
      const upd: Record<string, string | boolean> = {
        name: agentForm.model_id === 'custom' ? agentForm.custom_model_name || 'Агент' : agentSettings?.name || 'Пино',
        model_id: agentForm.model_id,
        custom_endpoint: agentForm.custom_endpoint,
        custom_model_name: agentForm.custom_model_name,
      };
      if (agentForm.api_key) upd.api_key_encrypted = agentForm.api_key;
      await api.agent.updateSettings(upd);
      setSaveOk(true);
      setTimeout(() => setSaveOk(false), 3000);
      await loadAll();
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  }

  async function logout() {
    try { await api.auth.logout(); } catch (e) { console.error(e); }
    clearToken();
    onLogout();
  }

  const levelIcon = (l: string) => l === 'principle' ? '🌳' : l === 'generalization' ? '🌿' : '🍃';

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 pt-4 pb-3 border-b border-border">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-primary/20 border-2 border-primary/30 flex items-center justify-center text-2xl font-bold text-primary">
            {user?.display_name?.[0]?.toUpperCase() || '?'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-base font-semibold text-foreground">{user?.display_name || 'Загрузка...'}</p>
            <p className="text-sm text-muted-foreground">@{user?.username || ''}</p>
          </div>
          <button onClick={logout} className="p-2 rounded-lg text-muted-foreground hover:text-destructive transition-colors" title="Выйти">
            <Icon name="LogOut" size={18} />
          </button>
        </div>
      </div>

      <div className="flex border-b border-border">
        {(['profile', 'agent', 'memory'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 py-2.5 text-xs font-medium transition-colors ${tab === t ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground'}`}>
            {t === 'profile' ? 'Профиль' : t === 'agent' ? 'Пино' : 'Память'}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {tab === 'profile' && (
          <div className="px-4 py-4 space-y-3">
            {[
              { key: 'display_name', label: 'Отображаемое имя', placeholder: 'Как тебя зовут' },
              { key: 'bio', label: 'О себе', placeholder: 'Пару слов о себе' },
              { key: 'city', label: 'Город', placeholder: 'Где живёшь' },
              { key: 'occupation', label: 'Работа / учёба', placeholder: 'Чем занимаешься' },
              { key: 'agent_name', label: 'Имя агента', placeholder: 'Пино' },
            ].map(f => (
              <div key={f.key}>
                <label className="text-xs text-muted-foreground mb-1 block">{f.label}</label>
                <input
                  value={profileForm[f.key as keyof typeof profileForm]}
                  onChange={e => setProfileForm(p => ({ ...p, [f.key]: e.target.value }))}
                  placeholder={f.placeholder}
                  className="w-full bg-card border border-border rounded-xl px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
            ))}

            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Интересы</label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {interests.map(i => (
                  <span key={i} className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs">
                    {i}
                    <button onClick={() => setInterests(prev => prev.filter(x => x !== i))} className="hover:text-destructive">
                      <Icon name="X" size={10} />
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  value={newInterest}
                  onChange={e => setNewInterest(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && newInterest.trim()) {
                      setInterests(p => [...p, newInterest.trim()]);
                      setNewInterest('');
                    }
                  }}
                  placeholder="Добавить интерес..."
                  className="flex-1 bg-card border border-border rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
                />
                <button onClick={() => { if (newInterest.trim()) { setInterests(p => [...p, newInterest.trim()]); setNewInterest(''); } }}
                  className="px-3 py-2 rounded-xl bg-primary/10 text-primary text-sm hover:bg-primary/20 transition-colors">
                  +
                </button>
              </div>
            </div>

            <button onClick={saveProfile} disabled={saving}
              className={`w-full py-3 rounded-xl text-sm font-medium transition-all ${saveOk ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-primary text-primary-foreground hover:opacity-90'} disabled:opacity-50`}>
              {saving ? 'Сохраняем...' : saveOk ? '✓ Сохранено' : 'Сохранить'}
            </button>
          </div>
        )}

        {tab === 'agent' && (
          <div className="px-4 py-4 space-y-4">
            <div className="rounded-xl border border-border bg-card p-4 space-y-3">
              <p className="text-sm font-semibold text-foreground">Модель Пино</p>

              <div>
                <label className="text-xs text-muted-foreground mb-1 block">AI-модель</label>
                <select
                  value={agentForm.model_id}
                  onChange={e => setAgentForm(f => ({ ...f, model_id: e.target.value }))}
                  className="w-full bg-background border border-border rounded-xl px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  {MODELS.map(m => (
                    <option key={m.id} value={m.id}>{m.label} ({m.group})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs text-muted-foreground mb-1 block">
                  API-ключ {agentSettings?.has_api_key ? '(уже сохранён)' : ''}
                </label>
                <div className="relative">
                  <input
                    type={showKey ? 'text' : 'password'}
                    value={agentForm.api_key}
                    onChange={e => setAgentForm(f => ({ ...f, api_key: e.target.value }))}
                    placeholder={agentSettings?.has_api_key ? '••••••••' : 'sk-...'}
                    className="w-full bg-background border border-border rounded-xl px-3 py-2.5 pr-10 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
                  />
                  <button onClick={() => setShowKey(!showKey)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    <Icon name={showKey ? 'EyeOff' : 'Eye'} size={14} />
                  </button>
                </div>
              </div>

              {agentForm.model_id === 'custom' && (
                <>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Endpoint URL</label>
                    <input
                      value={agentForm.custom_endpoint}
                      onChange={e => setAgentForm(f => ({ ...f, custom_endpoint: e.target.value }))}
                      placeholder="https://api.example.com/v1/chat/completions"
                      className="w-full bg-background border border-border rounded-xl px-3 py-2.5 text-sm text-foreground focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Название модели</label>
                    <input
                      value={agentForm.custom_model_name}
                      onChange={e => setAgentForm(f => ({ ...f, custom_model_name: e.target.value }))}
                      placeholder="gpt-4o"
                      className="w-full bg-background border border-border rounded-xl px-3 py-2.5 text-sm text-foreground focus:outline-none"
                    />
                  </div>
                </>
              )}
            </div>

            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-xs text-emerald-400">
              <p className="font-medium mb-1">Философия Пино</p>
              <p className="leading-relaxed opacity-80">«Деревья — это корни земли, тянущиеся к свету. Я помогаю тебе расти, запоминая каждый наш разговор.»</p>
            </div>

            <button onClick={saveAgent} disabled={saving}
              className={`w-full py-3 rounded-xl text-sm font-medium transition-all ${saveOk ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-primary text-primary-foreground hover:opacity-90'} disabled:opacity-50`}>
              {saving ? 'Сохраняем...' : saveOk ? '✓ Сохранено' : 'Сохранить настройки'}
            </button>
          </div>
        )}

        {tab === 'memory' && (
          <div className="px-4 py-4 space-y-2">
            <p className="text-xs text-muted-foreground mb-3">
              {memories.length === 0 ? 'Пино ещё ничего не запомнил. Поговори с ним!' : `${memories.length} записей в памяти`}
            </p>
            {memories.map(m => (
              <div key={m.id} className="flex items-start gap-2.5 p-3 rounded-xl bg-card border border-border hover:border-primary/30 transition-colors">
                <span className="text-base mt-0.5">{levelIcon(m.level)}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground leading-relaxed">{m.content}</p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="px-1.5 py-0.5 rounded bg-muted text-muted-foreground text-xs">{m.category}</span>
                    <span className="text-xs text-muted-foreground">{Math.round(m.confidence * 100)}% уверенность</span>
                  </div>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <button onClick={() => api.agent.feedback(m.id, 'positive')} className="p-1 rounded hover:bg-emerald-500/10 text-muted-foreground hover:text-emerald-400 transition-colors">
                    <Icon name="ThumbsUp" size={12} />
                  </button>
                  <button onClick={() => api.agent.feedback(m.id, 'negative')} className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                    <Icon name="ThumbsDown" size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
