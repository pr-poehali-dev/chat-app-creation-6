import { useState, useRef, useEffect, useCallback } from "react";
import Icon from "@/components/ui/icon";
import {
  loadProfile, saveProfile,
  loadMemory, saveMemorySection,
  loadAISettings, saveAISettings,
  loadPrivacy, savePrivacy,
  type AgentMemory,
} from "@/lib/storage";

interface AIModel {
  id: string;
  provider: string;
  providerLabel: string;
  name: string;
  keyPlaceholder: string;
  docsUrl: string;
}

const FREE_MODELS: AIModel[] = [
  { id: "anthropic/claude-3.5-haiku:free", provider: "Claude", providerLabel: "🧠", name: "Claude 3.5 Haiku", keyPlaceholder: "sk-or-...", docsUrl: "https://openrouter.ai/keys" },
  { id: "deepseek/deepseek-chat-v3-0324:free", provider: "DeepSeek", providerLabel: "🇨🇳", name: "DeepSeek V3", keyPlaceholder: "sk-or-...", docsUrl: "https://openrouter.ai/keys" },
  { id: "custom", provider: "Свой API", providerLabel: "🔧", name: "OpenAI-совместимый", keyPlaceholder: "ключ...", docsUrl: "" },
];

const MEMORY_SECTIONS = [
  { key: "personal" as keyof AgentMemory, label: "Личное", icon: "User", color: "text-blue-400", hint: "Имя, возраст, город, характер" },
  { key: "interests" as keyof AgentMemory, label: "Интересы", icon: "Heart", color: "text-pink-400", hint: "Хобби, увлечения, предпочтения" },
  { key: "work" as keyof AgentMemory, label: "Работа", icon: "Briefcase", color: "text-amber-400", hint: "Профессия, навыки, проекты" },
  { key: "social" as keyof AgentMemory, label: "Социальное", icon: "Users", color: "text-emerald-400", hint: "Друзья, контакты, связи" },
  { key: "private" as keyof AgentMemory, label: "Приватное", icon: "Lock", color: "text-muted-foreground", hint: "Только ты видишь. Агент не раскрывает это никому." },
];

const PRIVACY_ITEMS = [
  { id: "personal", label: "Личное" },
  { id: "social", label: "Социальное" },
  { id: "work", label: "Работа" },
  { id: "interests", label: "Интересы" },
  { id: "contacts", label: "Контакты" },
];

export default function Profile() {
  // Загружаем данные из localStorage при старте
  const [profile, setProfile] = useState(loadProfile);
  const [newInterest, setNewInterest] = useState("");
  const [privacy, setPrivacy] = useState(loadPrivacy);

  // Нейросеть
  const savedAI = loadAISettings();
  const [selectedModelId, setSelectedModelId] = useState(savedAI.modelId);
  const [apiKey, setApiKey] = useState(savedAI.apiKey);
  const [customEndpoint, setCustomEndpoint] = useState(savedAI.customEndpoint);
  const [customModelName, setCustomModelName] = useState(savedAI.customModelName);
  const [showKey, setShowKey] = useState(false);
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Память агента
  const [memory, setMemory] = useState<AgentMemory>(loadMemory);
  const [activeMemorySection, setActiveMemorySection] = useState<keyof AgentMemory>("personal");

  const [saved, setSaved] = useState(false);
  const [activeTab, setActiveTab] = useState<"profile" | "memory" | "ai">("profile");

  const selectedModel = FREE_MODELS.find((m) => m.id === selectedModelId) || FREE_MODELS[0];

  // Закрытие дропдауна по клику снаружи
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setModelDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const addInterest = () => {
    if (!newInterest.trim()) return;
    setProfile((p) => ({ ...p, interests: [...p.interests, newInterest.trim()] }));
    setNewInterest("");
  };

  const removeInterest = (i: number) => {
    setProfile((p) => ({ ...p, interests: p.interests.filter((_, idx) => idx !== i) }));
  };

  // Сохраняем раздел памяти сразу при изменении
  const handleMemoryChange = useCallback((section: keyof AgentMemory, value: string) => {
    setMemory((m) => ({ ...m, [section]: value }));
    saveMemorySection(section, value);
  }, []);

  const handleSave = () => {
    saveProfile(profile);
    savePrivacy(privacy);
    saveAISettings({ modelId: selectedModelId, apiKey, customEndpoint, customModelName });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const cyclePrivacy = (id: string) => {
    const order: Array<"public" | "request" | "private"> = ["public", "request", "private"];
    setPrivacy((p) => ({ ...p, [id]: order[(order.indexOf(p[id]) + 1) % order.length] }));
  };

  const privacyIcon: Record<string, string> = { public: "Eye", request: "AlertCircle", private: "EyeOff" };
  const privacyLabel: Record<string, string> = { public: "Видно", request: "По запросу", private: "Скрыто" };
  const privacyColor: Record<string, string> = { public: "text-emerald-400", request: "text-amber-400", private: "text-muted-foreground" };

  const providerGroups = FREE_MODELS.reduce<Record<string, AIModel[]>>((acc, m) => {
    if (!acc[m.provider]) acc[m.provider] = [];
    acc[m.provider].push(m);
    return acc;
  }, {});

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border flex-shrink-0">
        <h2 className="text-sm font-semibold">Профиль и агент</h2>
        <button
          onClick={handleSave}
          className={`text-xs px-3 py-1.5 rounded-lg transition-all ${saved ? "bg-emerald-500/20 text-emerald-400" : "bg-primary/20 text-primary hover:bg-primary/30"}`}
        >
          {saved ? "Сохранено ✓" : "Сохранить"}
        </button>
      </div>

      {/* Вкладки */}
      <div className="flex border-b border-border flex-shrink-0">
        {[
          { id: "profile" as const, label: "Профиль" },
          { id: "memory" as const, label: "Память агента" },
          { id: "ai" as const, label: "Нейросеть" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 py-2.5 text-xs font-medium transition-all border-b-2 ${
              activeTab === tab.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">

        {/* === ПРОФИЛЬ === */}
        {activeTab === "profile" && (
          <div className="px-5 py-4 space-y-5">
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
                    value={profile[field.key as keyof typeof profile] as string}
                    onChange={(e) => setProfile((p) => ({ ...p, [field.key]: e.target.value }))}
                    placeholder={field.placeholder}
                    className="bg-transparent text-sm outline-none placeholder:text-muted-foreground/50 flex-1 min-w-0"
                  />
                </div>
              ))}
            </div>

            <div>
              <div className="text-xs font-medium text-muted-foreground mb-2">Интересы</div>
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
                  placeholder="Добавить..."
                  className="flex-1 bg-card border border-border rounded-xl px-3 py-2 text-sm outline-none placeholder:text-muted-foreground/50 focus:border-primary/30 transition-colors"
                />
                <button onClick={addInterest} className="px-3 py-2 bg-primary/20 text-primary rounded-xl hover:bg-primary/30 transition-colors">
                  <Icon name="Plus" size={16} />
                </button>
              </div>
            </div>

            <div>
              <div className="text-xs font-medium text-muted-foreground mb-1.5">Приватность агента</div>
              <p className="text-[11px] text-muted-foreground/60 mb-3 leading-relaxed">
                Твои настройки видны только тебе. Другие участники группы настраивают своего агента независимо.
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
          </div>
        )}

        {/* === ПАМЯТЬ АГЕНТА === */}
        {activeTab === "memory" && (
          <div className="flex flex-col h-full">
            <div className="px-5 pt-4 pb-2">
              <p className="text-[11px] text-muted-foreground/70 leading-relaxed">
                Данные хранятся на твоём устройстве, разделены по категориям. Агент читает и записывает сюда то, что узнаёт о тебе — автоматически или после разговора.
              </p>
            </div>

            <div className="flex gap-1.5 px-5 pb-3 overflow-x-auto flex-shrink-0 scrollbar-none">
              {MEMORY_SECTIONS.map((s) => (
                <button
                  key={s.key}
                  onClick={() => setActiveMemorySection(s.key)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs whitespace-nowrap transition-all border flex-shrink-0 ${
                    activeMemorySection === s.key
                      ? "bg-primary/20 border-primary/30 text-primary"
                      : "bg-card border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Icon name={s.icon as never} size={11} className={activeMemorySection === s.key ? "text-primary" : s.color} />
                  {s.label}
                </button>
              ))}
            </div>

            {MEMORY_SECTIONS.filter((s) => s.key === activeMemorySection).map((section) => (
              <div key={section.key} className="flex-1 flex flex-col px-5 pb-5 animate-fade-in">
                <div className="flex items-center gap-2 mb-2">
                  <Icon name={section.icon as never} size={14} className={section.color} />
                  <span className="text-sm font-medium">{section.label}</span>
                  {section.key === "private" && (
                    <span className="text-[10px] bg-secondary text-muted-foreground px-2 py-0.5 rounded-full ml-auto">только для тебя</span>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground/60 mb-2">{section.hint}</p>
                <textarea
                  value={memory[section.key]}
                  onChange={(e) => handleMemoryChange(section.key, e.target.value)}
                  placeholder={`Агент будет записывать сюда информацию о тебе...\n\nТы тоже можешь добавить что-нибудь вручную.`}
                  className="flex-1 min-h-[200px] bg-card border border-border rounded-2xl px-4 py-3.5 text-sm outline-none placeholder:text-muted-foreground/30 focus:border-primary/30 transition-colors resize-none leading-relaxed"
                />
                <div className="flex items-center justify-between mt-2">
                  <span className="text-[10px] text-muted-foreground/40">
                    {memory[section.key].length} символов · сохраняется автоматически
                  </span>
                  <button
                    onClick={() => handleMemoryChange(section.key, "")}
                    className="text-[11px] text-muted-foreground/50 hover:text-destructive transition-colors"
                  >
                    Очистить
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* === НЕЙРОСЕТЬ === */}
        {activeTab === "ai" && (
          <div className="px-5 py-4 space-y-4">
            <div>
              <div className="text-xs font-medium text-muted-foreground mb-2">Модель агента</div>

              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setModelDropdownOpen(!modelDropdownOpen)}
                  className="w-full flex items-center justify-between bg-card border border-border rounded-xl px-4 py-3 hover:border-primary/30 transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-lg leading-none">{selectedModel.providerLabel}</span>
                    <div className="text-left">
                      <div className="text-sm font-medium">{selectedModel.name}</div>
                      <div className="text-[11px] text-muted-foreground">{selectedModel.provider} · бесплатно</div>
                    </div>
                  </div>
                  <Icon
                    name="ChevronDown"
                    size={16}
                    className={`text-muted-foreground transition-transform ${modelDropdownOpen ? "rotate-180" : ""}`}
                  />
                </button>

                {modelDropdownOpen && (
                  <div className="absolute top-full left-0 right-0 mt-1.5 bg-card border border-border rounded-2xl shadow-xl z-50 overflow-hidden">
                    <div className="max-h-72 overflow-y-auto py-1.5">
                      {Object.entries(providerGroups).map(([providerName, models]) => (
                        <div key={providerName}>
                          <div className="px-4 py-1.5 text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-wider">
                            {models[0].providerLabel} {providerName}
                          </div>
                          {models.map((m) => (
                            <button
                              key={m.id}
                              onClick={() => { setSelectedModelId(m.id); setModelDropdownOpen(false); }}
                              className={`w-full flex items-center justify-between px-4 py-2.5 text-sm transition-colors hover:bg-secondary/50 ${
                                selectedModelId === m.id ? "text-primary bg-primary/5" : "text-foreground"
                              }`}
                            >
                              <span>{m.name}</span>
                              {selectedModelId === m.id && <Icon name="Check" size={13} className="text-primary" />}
                            </button>
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {selectedModelId === "custom" && (
              <div className="space-y-2">
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
                    value={customModelName}
                    onChange={(e) => setCustomModelName(e.target.value)}
                    placeholder="название модели"
                    className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/40"
                  />
                </div>
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <div className="text-xs font-medium text-muted-foreground">API ключ</div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground/50 bg-secondary px-2 py-0.5 rounded-full">необязательно</span>
                  {selectedModel.docsUrl && (
                    <a
                      href={selectedModel.docsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] text-primary/70 hover:text-primary transition-colors flex items-center gap-0.5"
                    >
                      Получить <Icon name="ExternalLink" size={9} />
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
                  placeholder={`${selectedModel.keyPlaceholder} (оставь пустым для общего доступа)`}
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
                  <span className="text-foreground/70 font-medium">Свой ключ:</span> запросы идут напрямую к провайдеру, данные не проходят через наши серверы.
                </p>
              </div>
              <div className="flex items-start gap-2.5">
                <Icon name="HardDrive" size={13} className="text-primary mt-0.5 flex-shrink-0" />
                <p className="text-[11px] text-muted-foreground/80 leading-relaxed">
                  <span className="text-foreground/70 font-medium">Память агента</span> хранится только на твоём устройстве. Никакой сервер её не получает.
                </p>
              </div>
            </div>

            <button
              onClick={handleSave}
              className="w-full py-3 bg-primary/20 text-primary rounded-xl text-sm font-medium hover:bg-primary/30 transition-colors"
            >
              Сохранить настройки
            </button>
          </div>
        )}
      </div>
    </div>
  );
}