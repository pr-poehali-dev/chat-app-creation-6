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

const PRIVACY_ITEMS = [
  { id: "name", label: "Имя", desc: "Виден другим агентам" },
  { id: "city", label: "Город", desc: "Виден другим агентам" },
  { id: "occupation", label: "Работа", desc: "Только по запросу" },
  { id: "interests", label: "Интересы", desc: "Только по запросу" },
  { id: "contacts", label: "Контакты", desc: "Скрыто" },
  { id: "age", label: "Возраст", desc: "Скрыто" },
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
  const [saved, setSaved] = useState(false);

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
            saved
              ? "bg-emerald-500/20 text-emerald-400"
              : "bg-primary/20 text-primary hover:bg-primary/30"
          }`}
        >
          {saved ? "Сохранено ✓" : "Сохранить"}
        </button>
      </div>

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
                value={profile[field.key as keyof ProfileData] as string}
                onChange={(e) => setProfile((p) => ({ ...p, [field.key]: e.target.value }))}
                placeholder={field.placeholder}
                className="bg-transparent text-sm outline-none placeholder:text-muted-foreground/50 flex-1 min-w-0"
              />
            </div>
          ))}
        </div>

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

        <div>
          <div className="text-xs font-medium text-muted-foreground mb-2">Приватность агента</div>
          <p className="text-xs text-muted-foreground/70 mb-3">Что агент может рассказать другим агентам</p>
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

        <div className="pb-4 space-y-3">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <div className="text-xs font-medium text-muted-foreground">API ключ DeepSeek</div>
              <span className="text-[10px] text-muted-foreground/50 bg-secondary px-2 py-0.5 rounded-full">необязательно</span>
            </div>
            <div className="flex items-center gap-2 bg-card border border-border rounded-xl px-3 py-2.5 focus-within:border-primary/30 transition-colors">
              <Icon name="Key" size={14} className="text-muted-foreground" />
              <input
                type="password"
                placeholder="sk-... (оставь пустым для общего доступа)"
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/40 font-mono"
              />
              <Icon name="Eye" size={14} className="text-muted-foreground cursor-pointer hover:text-foreground transition-colors" />
            </div>
          </div>
          <div className="p-3.5 bg-secondary/30 rounded-xl space-y-2.5">
            <div className="flex items-start gap-2.5">
              <Icon name="ShieldCheck" size={13} className="text-emerald-400 mt-0.5 flex-shrink-0" />
              <p className="text-[11px] text-muted-foreground/80 leading-relaxed">
                <span className="text-foreground/70 font-medium">Свой ключ:</span> данные обрабатываются напрямую в DeepSeek, мы ничего не видим. Максимальная приватность.
              </p>
            </div>
            <div className="flex items-start gap-2.5">
              <Icon name="Zap" size={13} className="text-primary mt-0.5 flex-shrink-0" />
              <p className="text-[11px] text-muted-foreground/80 leading-relaxed">
                <span className="text-foreground/70 font-medium">Без ключа:</span> используется общий доступ — работает сразу, но история чатов может храниться на сервере.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}