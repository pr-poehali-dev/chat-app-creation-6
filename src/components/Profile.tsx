import { useState } from "react";
import Icon from "@/components/ui/icon";

interface ProfileData {
  name: string;
  age: string;
  city: string;
  occupation: string;
  interests: string[];
  agentName: string;
}

interface AIProvider {
  id: string;
  name: string;
  label: string;
  models: { id: string; name: string; free: boolean }[];
  placeholder: string;
  docsUrl: string;
  free: boolean;
}

const AI_PROVIDERS: AIProvider[] = [
  {
    id: "deepseek",
    name: "DeepSeek",
    label: "🇨🇳",
    free: true,
    placeholder: "sk-...",
    docsUrl: "https://platform.deepseek.com/api-keys",
    models: [
      { id: "deepseek-chat", name: "DeepSeek V3", free: true },
      { id: "deepseek-reasoner", name: "DeepSeek R1", free: false },
    ],
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    label: "🔀",
    free: true,
    placeholder: "sk-or-...",
    docsUrl: "https://openrouter.ai/keys",
    models: [
      { id: "mistralai/mistral-7b-instruct:free", name: "Mistral 7B (бесплатно)", free: true },
      { id: "meta-llama/llama-3.1-8b-instruct:free", name: "Llama 3.1 8B (бесплатно)", free: true },
      { id: "google/gemma-3-27b-it:free", name: "Gemma 3 27B (бесплатно)", free: true },
      { id: "deepseek/deepseek-chat-v3-0324:free", name: "DeepSeek V3 (бесплатно)", free: true },
      { id: "anthropic/claude-3.5-sonnet", name: "Claude 3.5 Sonnet", free: false },
      { id: "openai/gpt-4o", name: "GPT-4o", free: false },
    ],
  },
  {
    id: "groq",
    name: "Groq",
    label: "⚡",
    free: true,
    placeholder: "gsk_...",
    docsUrl: "https://console.groq.com/keys",
    models: [
      { id: "llama-3.1-8b-instant", name: "Llama 3.1 8B (бесплатно)", free: true },
      { id: "llama-3.3-70b-versatile", name: "Llama 3.3 70B (бесплатно)", free: true },
      { id: "gemma2-9b-it", name: "Gemma 2 9B (бесплатно)", free: true },
      { id: "mixtral-8x7b-32768", name: "Mixtral 8x7B (бесплатно)", free: true },
    ],
  },
  {
    id: "openai",
    name: "OpenAI",
    label: "🤖",
    free: false,
    placeholder: "sk-...",
    docsUrl: "https://platform.openai.com/api-keys",
    models: [
      { id: "gpt-4o-mini", name: "GPT-4o mini", free: false },
      { id: "gpt-4o", name: "GPT-4o", free: false },
    ],
  },
  {
    id: "custom",
    name: "Свой",
    label: "🔧",
    free: true,
    placeholder: "ключ...",
    docsUrl: "",
    models: [
      { id: "custom", name: "Указать вручную", free: true },
    ],
  },
];

const PRIVACY_ITEMS = [
  { id: "name", label: "Имя" },
  { id: "city", label: "Город" },
  { id: "occupation", label: "Работа" },
  { id: "interests", label: "Интересы" },
  { id: "contacts", label: "Контакты" },
  { id: "age", label: "Возраст" },
];

export default function Profile() {
  const [profile, setProfile] = useState<ProfileData>({
    name: "",
    age: "",
    city: "",
    occupation: "",
    interests: [],
    agentName: "Мой агент",
  });
  const [newInterest, setNewInterest] = useState("");
  const [privacy, setPrivacy] = useState<Record<string, "public" | "request" | "private">>({
    name: "public",
    city: "public",
    occupation: "request",
    interests: "request",
    contacts: "private",
    age: "private",
  });

  const [selectedProvider, setSelectedProvider] = useState("deepseek");
  const [selectedModel, setSelectedModel] = useState("deepseek-chat");
  const [apiKey, setApiKey] = useState("");
  const [customEndpoint, setCustomEndpoint] = useState("");
  const [customModel, setCustomModel] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [saved, setSaved] = useState(false);

  const provider = AI_PROVIDERS.find((p) => p.id === selectedProvider)!;

  const addInterest = () => {
    if (!newInterest.trim()) return;
    setProfile((p) => ({ ...p, interests: [...p.interests, newInterest.trim()] }));
    setNewInterest("");
  };

  const removeInterest = (i: number) => {
    setProfile((p) => ({ ...p, interests: p.interests.filter((_, idx) => idx !== i) }));
  };

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const cyclePrivacy = (id: string) => {
    const order: Array<"public" | "request" | "private"> = ["public", "request", "private"];
    setPrivacy((p) => {
      const current = p[id];
      const next = order[(order.indexOf(current) + 1) % order.length];
      return { ...p, [id]: next };
    });
  };

  const privacyIcon: Record<string, string> = {
    public: "Eye",
    request: "AlertCircle",
    private: "EyeOff",
  };
  const privacyLabel: Record<string, string> = {
    public: "Видно агентам",
    request: "По запросу",
    private: "Скрыто",
  };
  const privacyColor: Record<string, string> = {
    public: "text-emerald-400",
    request: "text-amber-400",
    private: "text-muted-foreground",
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <h2 className="text-sm font-semibold">Профиль и агент</h2>
        <button
          onClick={handleSave}
          className={`text-xs px-3 py-1.5 rounded-lg transition-all ${
            saved ? "bg-emerald-500/20 text-emerald-400" : "bg-primary/20 text-primary hover:bg-primary/30"
          }`}
        >
          {saved ? "Сохранено ✓" : "Сохранить"}
        </button>
      </div>

      <div className="px-5 py-4 space-y-5">
        {/* Профиль */}
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center text-2xl font-bold text-muted-foreground">
              {profile.name ? profile.name[0].toUpperCase() : "?"}
            </div>
            <button className="absolute -bottom-1 -right-1 w-6 h-6 bg-primary rounded-lg flex items-center justify-center">
              <Icon name="Plus" size={12} className="text-primary-foreground" />
            </button>
          </div>
          <div className="flex-1">
            <input
              value={profile.name}
              onChange={(e) => setProfile((p) => ({ ...p, name: e.target.value }))}
              placeholder="Твоё имя"
              className="w-full bg-transparent text-base font-semibold outline-none placeholder:text-muted-foreground/50 border-b border-transparent focus:border-primary/30 pb-0.5 transition-colors"
            />
            <div className="flex items-center gap-1.5 mt-1">
              <Icon name="Sparkles" size={11} className="text-primary" />
              <input
                value={profile.agentName}
                onChange={(e) => setProfile((p) => ({ ...p, agentName: e.target.value }))}
                className="bg-transparent text-xs text-muted-foreground outline-none border-b border-transparent focus:border-primary/30 transition-colors"
                placeholder="Имя агента"
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          {[
            { key: "city", placeholder: "Город", icon: "MapPin" },
            { key: "age", placeholder: "Возраст", icon: "Calendar" },
            { key: "occupation", placeholder: "Работа / занятие", icon: "Briefcase" },
          ].map((field) => (
            <div key={field.key} className={`flex items-center gap-2.5 bg-card border border-border rounded-xl px-3 py-2.5 focus-within:border-primary/30 transition-colors ${field.key === "occupation" ? "col-span-2" : ""}`}>
              <Icon name={field.icon as never} size={14} className="text-muted-foreground flex-shrink-0" />
              <input
                value={profile[field.key as keyof ProfileData] as string}
                onChange={(e) => setProfile((p) => ({ ...p, [field.key]: e.target.value }))}
                placeholder={field.placeholder}
                className="bg-transparent text-sm outline-none placeholder:text-muted-foreground/50 flex-1 min-w-0"
              />
            </div>
          ))}
        </div>

        {/* Интересы */}
        <div>
          <div className="text-xs font-medium text-muted-foreground mb-2">Интересы и увлечения</div>
          <div className="flex flex-wrap gap-2 mb-2">
            {profile.interests.map((interest, i) => (
              <span key={i} className="flex items-center gap-1.5 px-3 py-1 bg-primary/10 text-primary rounded-full text-xs">
                {interest}
                <button onClick={() => removeInterest(i)} className="hover:text-destructive transition-colors">
                  <Icon name="X" size={10} />
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              value={newInterest}
              onChange={(e) => setNewInterest(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addInterest()}
              placeholder="Добавить интерес..."
              className="flex-1 bg-card border border-border rounded-xl px-3 py-2 text-sm outline-none placeholder:text-muted-foreground/50 focus:border-primary/30 transition-colors"
            />
            <button onClick={addInterest} className="px-3 py-2 bg-primary/20 text-primary rounded-xl hover:bg-primary/30 transition-colors">
              <Icon name="Plus" size={16} />
            </button>
          </div>
        </div>

        {/* Приватность */}
        <div>
          <div className="text-xs font-medium text-muted-foreground mb-1.5">Приватность агента</div>
          <p className="text-[11px] text-muted-foreground/60 mb-3 leading-relaxed">
            Только ты видишь эти настройки. Каждый участник группы настраивает своего агента независимо.
          </p>
          <div className="space-y-1.5">
            {PRIVACY_ITEMS.map((item) => (
              <div key={item.id} className="flex items-center justify-between py-2.5 px-3.5 bg-card border border-border rounded-xl">
                <span className="text-sm">{item.label}</span>
                <button
                  onClick={() => cyclePrivacy(item.id)}
                  className={`flex items-center gap-1.5 text-xs transition-colors ${privacyColor[privacy[item.id]]}`}
                >
                  <Icon name={privacyIcon[privacy[item.id]] as never} size={12} />
                  {privacyLabel[privacy[item.id]]}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Нейросеть */}
        <div className="pb-4 space-y-3">
          <div className="text-xs font-medium text-muted-foreground">Нейросеть агента</div>

          {/* Выбор провайдера */}
          <div className="grid grid-cols-5 gap-1.5">
            {AI_PROVIDERS.map((p) => (
              <button
                key={p.id}
                onClick={() => {
                  setSelectedProvider(p.id);
                  setSelectedModel(p.models[0].id);
                }}
                className={`flex flex-col items-center gap-1 py-2.5 rounded-xl text-xs transition-all border ${
                  selectedProvider === p.id
                    ? "bg-primary/20 border-primary/40 text-primary"
                    : "bg-card border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                <span className="text-base leading-none">{p.label}</span>
                <span className="leading-none">{p.name}</span>
                {p.free && <span className="text-[9px] text-emerald-400 leading-none">free</span>}
              </button>
            ))}
          </div>

          {/* Выбор модели */}
          <div>
            <div className="text-[11px] text-muted-foreground/70 mb-1.5">Модель</div>
            <div className="space-y-1">
              {provider.models.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setSelectedModel(m.id)}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm transition-all border ${
                    selectedModel === m.id
                      ? "bg-primary/15 border-primary/30 text-foreground"
                      : "bg-card border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <span>{m.name}</span>
                  {m.free && (
                    <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">бесплатно</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Кастомный endpoint */}
          {selectedProvider === "custom" && (
            <div className="space-y-2 animate-fade-in">
              <div className="flex items-center gap-2 bg-card border border-border rounded-xl px-3 py-2.5 focus-within:border-primary/30 transition-colors">
                <Icon name="Globe" size={14} className="text-muted-foreground flex-shrink-0" />
                <input
                  value={customEndpoint}
                  onChange={(e) => setCustomEndpoint(e.target.value)}
                  placeholder="https://api.example.com/v1"
                  className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/40 font-mono"
                />
              </div>
              <div className="flex items-center gap-2 bg-card border border-border rounded-xl px-3 py-2.5 focus-within:border-primary/30 transition-colors">
                <Icon name="Cpu" size={14} className="text-muted-foreground flex-shrink-0" />
                <input
                  value={customModel}
                  onChange={(e) => setCustomModel(e.target.value)}
                  placeholder="название модели"
                  className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/40"
                />
              </div>
            </div>
          )}

          {/* API ключ */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <div className="text-[11px] text-muted-foreground/70">API ключ</div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-muted-foreground/50 bg-secondary px-2 py-0.5 rounded-full">необязательно</span>
                {provider.docsUrl && (
                  <a
                    href={provider.docsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] text-primary/70 hover:text-primary transition-colors flex items-center gap-0.5"
                  >
                    Получить
                    <Icon name="ExternalLink" size={9} />
                  </a>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 bg-card border border-border rounded-xl px-3 py-2.5 focus-within:border-primary/30 transition-colors">
              <Icon name="Key" size={14} className="text-muted-foreground flex-shrink-0" />
              <input
                type={showKey ? "text" : "password"}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={`${provider.placeholder} (оставь пустым для общего доступа)`}
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/40 font-mono min-w-0"
              />
              <button onClick={() => setShowKey(!showKey)} className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0">
                <Icon name={showKey ? "EyeOff" : "Eye"} size={14} />
              </button>
            </div>
          </div>

          <div className="p-3.5 bg-secondary/30 rounded-xl space-y-2.5">
            <div className="flex items-start gap-2.5">
              <Icon name="ShieldCheck" size={13} className="text-emerald-400 mt-0.5 flex-shrink-0" />
              <p className="text-[11px] text-muted-foreground/80 leading-relaxed">
                <span className="text-foreground/70 font-medium">Свой ключ:</span> запросы идут напрямую, данные не проходят через наши серверы.
              </p>
            </div>
            <div className="flex items-start gap-2.5">
              <Icon name="Zap" size={13} className="text-primary mt-0.5 flex-shrink-0" />
              <p className="text-[11px] text-muted-foreground/80 leading-relaxed">
                <span className="text-foreground/70 font-medium">Без ключа:</span> работает сразу через общий доступ, но история может храниться на сервере.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
