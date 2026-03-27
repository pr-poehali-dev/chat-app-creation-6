import { useState } from "react";
import Icon from "@/components/ui/icon";

interface Friend {
  id: string;
  name: string;
  avatar: string;
  status: "online" | "away" | "offline";
  lastMessage: string;
  lastTime: string;
  unread?: number;
  agentActive?: boolean;
}

interface Message {
  id: string;
  role: "me" | "friend";
  text: string;
  time: string;
}

const FRIENDS: Friend[] = [
  { id: "1", name: "Алексей", avatar: "А", status: "online", lastMessage: "Агент договорился — встречаемся в пятницу", lastTime: "14:32", unread: 2, agentActive: true },
  { id: "2", name: "Мария", avatar: "М", status: "online", lastMessage: "Ок, расскажу агенту детали", lastTime: "12:10", agentActive: false },
  { id: "3", name: "Дмитрий", avatar: "Д", status: "away", lastMessage: "Интересная идея для проекта", lastTime: "вчера" },
  { id: "4", name: "Анна", avatar: "А", status: "offline", lastMessage: "Спасибо за рекомендацию!", lastTime: "пн" },
];

const DEMO_MESSAGES: Record<string, Message[]> = {
  "1": [
    { id: "1", role: "friend", text: "Привет! Мой агент написал мне, что ты хочешь обсудить проект", time: "14:20" },
    { id: "2", role: "me", text: "Да! Давай встретимся и обсудим детали", time: "14:25" },
    { id: "3", role: "friend", text: "Агент договорился — встречаемся в пятницу", time: "14:32" },
  ],
  "2": [
    { id: "1", role: "me", text: "Мария, добавил тебя в контакты!", time: "12:05" },
    { id: "2", role: "friend", text: "Ок, расскажу агенту детали", time: "12:10" },
  ],
};

const statusColor: Record<Friend["status"], string> = {
  online: "bg-emerald-500",
  away: "bg-amber-500",
  offline: "bg-muted-foreground",
};

export default function FriendsList() {
  const [selected, setSelected] = useState<Friend | null>(null);
  const [input, setInput] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [messages, setMessages] = useState<Record<string, Message[]>>(DEMO_MESSAGES);

  const sendMessage = () => {
    if (!input.trim() || !selected) return;
    const msg: Message = {
      id: Date.now().toString(),
      role: "me",
      text: input.trim(),
      time: new Date().toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit" }),
    };
    setMessages((prev) => ({
      ...prev,
      [selected.id]: [...(prev[selected.id] || []), msg],
    }));
    setInput("");
  };

  if (selected) {
    const chat = messages[selected.id] || [];
    return (
      <div className="flex flex-col h-full animate-fade-in">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-border">
          <button onClick={() => setSelected(null)} className="text-muted-foreground hover:text-foreground transition-colors mr-1">
            <Icon name="ChevronLeft" size={20} />
          </button>
          <div className="relative">
            <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-sm font-semibold">
              {selected.avatar}
            </div>
            <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 ${statusColor[selected.status]} rounded-full border-2 border-background`} />
          </div>
          <div className="flex-1">
            <div className="text-sm font-semibold">{selected.name}</div>
            <div className="text-xs text-muted-foreground capitalize">{selected.status === "online" ? "онлайн" : selected.status === "away" ? "отошёл" : "не в сети"}</div>
          </div>
          {selected.agentActive && (
            <div className="flex items-center gap-1.5 text-xs text-primary bg-primary/10 px-2.5 py-1 rounded-full">
              <Icon name="Sparkles" size={11} />
              <span>Агент активен</span>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {chat.length === 0 && (
            <div className="text-center text-muted-foreground text-sm py-8">Начни общение</div>
          )}
          {chat.map((msg) => (
            <div key={msg.id} className={`flex animate-fade-in ${msg.role === "me" ? "flex-row-reverse" : ""}`}>
              <div className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                msg.role === "me" ? "bg-primary text-primary-foreground rounded-tr-sm" : "bg-card text-foreground rounded-tl-sm"
              }`}>
                {msg.text}
                <div className={`text-[10px] mt-1 ${msg.role === "me" ? "text-primary-foreground/60" : "text-muted-foreground"}`}>{msg.time}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="px-4 pb-4 pt-2">
          <div className="flex gap-2 items-center bg-card border border-border rounded-2xl px-4 py-2.5 focus-within:border-primary/50 transition-colors">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendMessage()}
              placeholder={`Написать ${selected.name}...`}
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
            <button onClick={sendMessage} disabled={!input.trim()} className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center disabled:opacity-30 hover:bg-primary/90 transition-all">
              <Icon name="ArrowUp" size={14} className="text-primary-foreground" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <h2 className="text-sm font-semibold">Друзья</h2>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="text-muted-foreground hover:text-primary transition-colors"
        >
          <Icon name="UserPlus" size={18} />
        </button>
      </div>

      {showAdd && (
        <div className="mx-4 mt-3 p-4 bg-card border border-border rounded-2xl animate-scale-in">
          <div className="text-xs font-medium text-muted-foreground mb-3">Добавить друга</div>
          <div className="grid grid-cols-3 gap-2">
            {[
              { icon: "Link", label: "По ссылке" },
              { icon: "Users", label: "Контакты" },
              { icon: "Share2", label: "Соцсети" },
            ].map((item) => (
              <button key={item.label} className="flex flex-col items-center gap-2 p-3 rounded-xl bg-secondary/50 hover:bg-secondary transition-colors text-xs text-muted-foreground hover:text-foreground">
                <Icon name={item.icon as never} size={18} />
                {item.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {FRIENDS.map((friend) => (
          <button
            key={friend.id}
            onClick={() => setSelected(friend)}
            className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-card/60 transition-colors text-left"
          >
            <div className="relative flex-shrink-0">
              <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center text-sm font-semibold">
                {friend.avatar}
              </div>
              <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 ${statusColor[friend.status]} rounded-full border-2 border-background`} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 justify-between">
                <span className="text-sm font-medium">{friend.name}</span>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {friend.agentActive && <Icon name="Sparkles" size={11} className="text-primary" />}
                  <span className="text-[11px] text-muted-foreground">{friend.lastTime}</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground truncate">{friend.lastMessage}</p>
                {friend.unread && (
                  <span className="ml-2 flex-shrink-0 w-5 h-5 bg-primary rounded-full flex items-center justify-center text-[10px] font-semibold text-primary-foreground">
                    {friend.unread}
                  </span>
                )}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
