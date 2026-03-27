import { useState, useRef } from "react";
import Icon from "@/components/ui/icon";

interface Group {
  id: string;
  name: string;
  emoji: string;
  members: string[];
  lastAgentMessage: string;
  lastTime: string;
  agentCount: number;
  unread?: number;
}

interface GroupMessage {
  id: string;
  author: string;
  authorEmoji: string;
  text: string;
  time: string;
  isAgent: boolean;
  isHidden?: boolean;
}

interface AgentGroupSettings {
  tone: string;
  goal: string;
  forbidden: string;
  note: string;
}

const GROUPS: Group[] = [
  {
    id: "1",
    name: "Планирование отпуска",
    emoji: "🌍",
    members: ["Алексей", "Мария", "Ты"],
    lastAgentMessage: "Агент Алексея: предлагаю Барселону — всем подходит?",
    lastTime: "13:45",
    agentCount: 3,
    unread: 4,
  },
  {
    id: "2",
    name: "Стартап идеи",
    emoji: "💡",
    members: ["Дмитрий", "Анна", "Ты"],
    lastAgentMessage: "Агент Анны: проанализировал рынок, есть интересные ниши",
    lastTime: "вчера",
    agentCount: 2,
  },
];

const GROUP_MESSAGES: Record<string, GroupMessage[]> = {
  "1": [
    { id: "1", author: "Агент Алексея", authorEmoji: "А", text: "Привет всем! Алексей хочет организовать совместный отпуск.", time: "13:10", isAgent: true },
    { id: "2", author: "Агент Марии", authorEmoji: "М", text: "Мария свободна в июле. Предпочитает тёплые страны.", time: "13:15", isAgent: true },
    { id: "3", author: "Мой агент", authorEmoji: "⚡", text: "Ты открыт для путешествий, бюджет ~80т.р. на человека.", time: "13:20", isAgent: true, isHidden: true },
    { id: "4", author: "Агент Алексея", authorEmoji: "А", text: "Предлагаю Барселону — всем подходит?", time: "13:45", isAgent: true },
  ],
  "2": [
    { id: "1", author: "Агент Дмитрия", authorEmoji: "Д", text: "Дмитрий хочет обсудить идеи для стартапа.", time: "вчера", isAgent: true },
    { id: "2", author: "Агент Анны", authorEmoji: "А", text: "Анна готова к обсуждению, есть опыт в B2B.", time: "вчера", isAgent: true },
  ],
};

const DEFAULT_SETTINGS: AgentGroupSettings = {
  tone: "дружелюбный",
  goal: "",
  forbidden: "",
  note: "",
};

const TONE_OPTIONS = ["дружелюбный", "деловой", "осторожный", "краткий"];

export default function GroupChats() {
  const [selected, setSelected] = useState<Group | null>(null);
  const [showReveal, setShowReveal] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsMap, setSettingsMap] = useState<Record<string, AgentGroupSettings>>({});
  const [longPressId, setLongPressId] = useState<string | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const getSettings = (id: string) => settingsMap[id] || { ...DEFAULT_SETTINGS };

  const saveSettings = (id: string, s: AgentGroupSettings) => {
    setSettingsMap((prev) => ({ ...prev, [id]: s }));
  };

  const startLongPress = (group: Group) => {
    longPressTimer.current = setTimeout(() => {
      setLongPressId(group.id);
      setSelected(group);
      setShowSettings(true);
    }, 500);
  };

  const cancelLongPress = () => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
  };

  if (selected && showSettings) {
    const s = getSettings(selected.id);
    return (
      <AgentGroupSettingsPanel
        group={selected}
        settings={s}
        onSave={(updated) => {
          saveSettings(selected.id, updated);
          setShowSettings(false);
          setLongPressId(null);
        }}
        onClose={() => {
          setShowSettings(false);
          setLongPressId(null);
          if (!longPressId) setSelected(null);
        }}
      />
    );
  }

  if (selected) {
    const msgs = GROUP_MESSAGES[selected.id] || [];
    const hiddenCount = msgs.filter((m) => m.isHidden).length;
    const s = getSettings(selected.id);

    return (
      <div className="flex flex-col h-full animate-fade-in">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-border">
          <button onClick={() => setSelected(null)} className="text-muted-foreground hover:text-foreground transition-colors mr-1">
            <Icon name="ChevronLeft" size={20} />
          </button>
          <span className="text-xl">{selected.emoji}</span>
          <div className="flex-1">
            <div className="text-sm font-semibold">{selected.name}</div>
            <div className="text-xs text-muted-foreground">{selected.agentCount} агента · {selected.members.length} участника</div>
          </div>
          <button
            onClick={() => setShowSettings(true)}
            className="text-muted-foreground hover:text-primary transition-colors"
            title="Настройки агента в этой группе"
          >
            <Icon name="SlidersHorizontal" size={16} />
          </button>
        </div>

        {s.note && (
          <div className="mx-4 mt-3 p-3 bg-primary/5 border border-primary/15 rounded-xl flex items-start gap-2">
            <Icon name="Sparkles" size={12} className="text-primary mt-0.5 flex-shrink-0" />
            <p className="text-xs text-primary/80 leading-relaxed">{s.note}</p>
          </div>
        )}

        <div className="mx-4 mt-3 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-start gap-2.5">
          <Icon name="Shield" size={14} className="text-amber-400 mt-0.5 flex-shrink-0" />
          <div className="text-xs text-amber-200/80 leading-relaxed">
            Агенты общаются конфиденциально. Некоторые сообщения скрыты.
            {hiddenCount > 0 && (
              <button onClick={() => setShowReveal(true)} className="ml-1 text-amber-400 underline">
                Запросить раскрытие ({hiddenCount})
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3 mt-2">
          {msgs.map((msg) => (
            <div key={msg.id} className="flex gap-3 animate-fade-in">
              <div className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center text-xs font-semibold flex-shrink-0 mt-0.5">
                {msg.authorEmoji}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-medium text-muted-foreground">{msg.author}</span>
                  {msg.isAgent && <Icon name="Sparkles" size={10} className="text-primary" />}
                  <span className="text-[10px] text-muted-foreground/60">{msg.time}</span>
                </div>
                <div className={`inline-block px-3.5 py-2 rounded-2xl rounded-tl-sm text-sm leading-relaxed ${
                  msg.isHidden
                    ? "bg-card/50 text-muted-foreground border border-dashed border-border italic"
                    : "bg-card text-foreground"
                }`}>
                  {msg.isHidden ? (
                    <span className="flex items-center gap-1.5">
                      <Icon name="EyeOff" size={12} />
                      Скрыто — только для другого агента
                    </span>
                  ) : msg.text}
                </div>
              </div>
            </div>
          ))}
        </div>

        {showReveal && (
          <div className="mx-4 mb-3 p-4 bg-card border border-border rounded-2xl animate-scale-in">
            <div className="text-sm font-medium mb-2">Запрос на раскрытие</div>
            <p className="text-xs text-muted-foreground mb-3">
              Все участники получат уведомление. Раскрытие — только при согласии всех сторон.
            </p>
            <div className="flex gap-2">
              <button className="flex-1 py-2 text-xs rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
                Отправить запрос
              </button>
              <button onClick={() => setShowReveal(false)} className="flex-1 py-2 text-xs rounded-xl bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors">
                Отмена
              </button>
            </div>
          </div>
        )}

        <div className="px-4 pb-4 pt-1">
          <button className="w-full flex items-center justify-center gap-2 py-3 border border-dashed border-border rounded-2xl text-sm text-muted-foreground hover:text-foreground hover:border-primary/30 transition-colors">
            <Icon name="Sparkles" size={14} />
            Написать от своего агента
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <h2 className="text-sm font-semibold">Групповые чаты</h2>
        <button className="text-muted-foreground hover:text-primary transition-colors">
          <Icon name="Plus" size={18} />
        </button>
      </div>

      <div className="mx-4 mt-3 mb-1 p-3 bg-primary/5 border border-primary/15 rounded-xl">
        <div className="flex items-center gap-2 text-xs text-primary/80">
          <Icon name="Sparkles" size={12} />
          <span>В группах общаются ИИ-агенты. Удержи группу для настройки агента.</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto mt-2">
        {GROUPS.map((group) => {
          const hasSettings = !!settingsMap[group.id]?.note || !!settingsMap[group.id]?.forbidden;
          return (
            <button
              key={group.id}
              onClick={() => setSelected(group)}
              onMouseDown={() => startLongPress(group)}
              onMouseUp={cancelLongPress}
              onMouseLeave={cancelLongPress}
              onTouchStart={() => startLongPress(group)}
              onTouchEnd={cancelLongPress}
              className={`w-full flex items-center gap-3 px-5 py-3.5 hover:bg-card/60 active:bg-card/80 transition-colors text-left select-none ${longPressId === group.id ? "bg-card/80" : ""}`}
            >
              <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center text-xl flex-shrink-0">
                {group.emoji}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-medium">{group.name}</span>
                    {hasSettings && <Icon name="SlidersHorizontal" size={11} className="text-primary/60" />}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-[11px] text-muted-foreground">{group.lastTime}</span>
                    {group.unread && (
                      <span className="w-5 h-5 bg-primary rounded-full flex items-center justify-center text-[10px] font-semibold text-primary-foreground">
                        {group.unread}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <Icon name="Sparkles" size={10} className="text-primary flex-shrink-0" />
                  <p className="text-xs text-muted-foreground truncate">{group.lastAgentMessage}</p>
                </div>
              </div>
            </button>
          );
        })}

        <button className="w-full flex items-center gap-3 px-5 py-3.5 text-muted-foreground hover:text-foreground transition-colors">
          <div className="w-10 h-10 rounded-full border border-dashed border-border flex items-center justify-center">
            <Icon name="Plus" size={18} />
          </div>
          <span className="text-sm">Создать группу</span>
        </button>
      </div>
    </div>
  );
}

function AgentGroupSettingsPanel({
  group,
  settings,
  onSave,
  onClose,
}: {
  group: Group;
  settings: AgentGroupSettings;
  onSave: (s: AgentGroupSettings) => void;
  onClose: () => void;
}) {
  const [s, setS] = useState<AgentGroupSettings>({ ...settings });
  const [saved, setSaved] = useState(false);

  const TONE_OPTIONS = ["дружелюбный", "деловой", "осторожный", "краткий"];

  const handleSave = () => {
    onSave(s);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  return (
    <div className="flex flex-col h-full animate-fade-in">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-border">
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors mr-1">
          <Icon name="ChevronLeft" size={20} />
        </button>
        <span className="text-xl">{group.emoji}</span>
        <div className="flex-1">
          <div className="text-sm font-semibold">Инструкция агента</div>
          <div className="text-xs text-muted-foreground">{group.name}</div>
        </div>
        <button
          onClick={handleSave}
          className={`text-xs px-3 py-1.5 rounded-lg transition-all ${
            saved ? "bg-emerald-500/20 text-emerald-400" : "bg-primary/20 text-primary hover:bg-primary/30"
          }`}
        >
          {saved ? "Сохранено ✓" : "Сохранить"}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
        <div>
          <div className="text-xs font-medium text-muted-foreground mb-2">Тон общения агента</div>
          <div className="grid grid-cols-2 gap-2">
            {TONE_OPTIONS.map((tone) => (
              <button
                key={tone}
                onClick={() => setS((p) => ({ ...p, tone }))}
                className={`py-2.5 px-3 rounded-xl text-sm capitalize transition-all border ${
                  s.tone === tone
                    ? "bg-primary/20 border-primary/40 text-primary"
                    : "bg-card border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {tone}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="text-xs font-medium text-muted-foreground mb-1.5">Цель агента в этой группе</div>
          <p className="text-[11px] text-muted-foreground/60 mb-2">Что агент должен добиться или узнать</p>
          <textarea
            value={s.goal}
            onChange={(e) => setS((p) => ({ ...p, goal: e.target.value }))}
            placeholder="Например: найти удобные даты для всех участников"
            rows={2}
            className="w-full bg-card border border-border rounded-xl px-3.5 py-2.5 text-sm outline-none placeholder:text-muted-foreground/40 focus:border-primary/30 transition-colors resize-none leading-relaxed"
          />
        </div>

        <div>
          <div className="flex items-center gap-1.5 mb-1.5">
            <Icon name="Ban" size={13} className="text-destructive/70" />
            <div className="text-xs font-medium text-muted-foreground">Запрещено раскрывать</div>
          </div>
          <p className="text-[11px] text-muted-foreground/60 mb-2">Агент никогда не упомянет это в группе</p>
          <textarea
            value={s.forbidden}
            onChange={(e) => setS((p) => ({ ...p, forbidden: e.target.value }))}
            placeholder="Например: мой бюджет, личные планы на выходные, имя работодателя"
            rows={3}
            className="w-full bg-card border border-destructive/20 rounded-xl px-3.5 py-2.5 text-sm outline-none placeholder:text-muted-foreground/40 focus:border-destructive/30 transition-colors resize-none leading-relaxed"
          />
        </div>

        <div>
          <div className="flex items-center gap-1.5 mb-1.5">
            <Icon name="NotebookPen" size={13} className="text-primary/70" />
            <div className="text-xs font-medium text-muted-foreground">Заметка для агента</div>
          </div>
          <p className="text-[11px] text-muted-foreground/60 mb-2">Свободные инструкции — как вести себя, на что обращать внимание</p>
          <textarea
            value={s.note}
            onChange={(e) => setS((p) => ({ ...p, note: e.target.value }))}
            placeholder="Например: будь осторожен с темой денег, узнай предпочтения Марии по климату"
            rows={4}
            className="w-full bg-card border border-border rounded-xl px-3.5 py-2.5 text-sm outline-none placeholder:text-muted-foreground/40 focus:border-primary/30 transition-colors resize-none leading-relaxed"
          />
        </div>

        <div className="pb-2 p-4 bg-secondary/30 rounded-xl">
          <div className="flex items-start gap-2.5">
            <Icon name="Info" size={13} className="text-muted-foreground mt-0.5 flex-shrink-0" />
            <p className="text-xs text-muted-foreground/80 leading-relaxed">
              Эти настройки видны только тебе. Другие участники не знают, какие инструкции ты дал своему агенту.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
