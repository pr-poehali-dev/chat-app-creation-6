import { useState, useRef, useEffect } from "react";
import Icon from "@/components/ui/icon";

interface Message {
  id: string;
  role: "user" | "agent";
  text: string;
  time: string;
}

const INITIAL_MESSAGES: Message[] = [
  {
    id: "1",
    role: "agent",
    text: "Привет! Я твой личный ИИ-агент. Расскажи мне о себе — чем занимаешься, что тебя интересует? Чем больше ты мне доверишь, тем точнее я смогу помогать.",
    time: "сейчас",
  },
];

export default function AgentChat() {
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  const getTime = () =>
    new Date().toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit" });

  const sendMessage = async () => {
    if (!input.trim()) return;
    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      text: input.trim(),
      time: getTime(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsTyping(true);

    await new Promise((r) => setTimeout(r, 1200 + Math.random() * 800));

    const replies = [
      "Понял тебя. Запомню это для наших будущих разговоров.",
      "Интересно! Расскажи подробнее — это поможет мне лучше понять тебя.",
      "Отлично, я учту это в своей памяти о тебе.",
      "Хорошо. Есть что-то ещё, что важно знать?",
      "Записал. Теперь я знаю тебя немного лучше 😊",
    ];
    const agentMsg: Message = {
      id: (Date.now() + 1).toString(),
      role: "agent",
      text: replies[Math.floor(Math.random() * replies.length)],
      time: getTime(),
    };
    setIsTyping(false);
    setMessages((prev) => [...prev, agentMsg]);
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-border">
        <div className="relative">
          <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center agent-glow">
            <Icon name="Sparkles" size={16} className="text-primary" />
          </div>
          <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full border-2 border-background animate-pulse-dot" />
        </div>
        <div>
          <div className="text-sm font-semibold">Мой агент</div>
          <div className="text-xs text-muted-foreground">DeepSeek · онлайн</div>
        </div>
        <button className="ml-auto text-muted-foreground hover:text-foreground transition-colors">
          <Icon name="Settings" size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex gap-3 animate-fade-in ${msg.role === "user" ? "flex-row-reverse" : ""}`}
          >
            {msg.role === "agent" && (
              <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Icon name="Sparkles" size={12} className="text-primary" />
              </div>
            )}
            <div className={`max-w-[75%] ${msg.role === "user" ? "items-end" : "items-start"} flex flex-col gap-1`}>
              <div
                className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground rounded-tr-sm"
                    : "bg-card text-foreground rounded-tl-sm"
                }`}
              >
                {msg.text}
              </div>
              <span className="text-[11px] text-muted-foreground px-1">{msg.time}</span>
            </div>
          </div>
        ))}

        {isTyping && (
          <div className="flex gap-3 animate-fade-in">
            <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
              <Icon name="Sparkles" size={12} className="text-primary" />
            </div>
            <div className="bg-card px-4 py-3 rounded-2xl rounded-tl-sm flex gap-1 items-center">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="w-1.5 h-1.5 bg-muted-foreground rounded-full"
                  style={{ animation: `typing 1.2s ease ${i * 0.2}s infinite` }}
                />
              ))}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="px-4 pb-4 pt-2">
        <div className="flex gap-2 items-end bg-card border border-border rounded-2xl px-4 py-2.5 focus-within:border-primary/50 transition-colors">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Напиши своему агенту..."
            rows={1}
            className="flex-1 bg-transparent text-sm resize-none outline-none placeholder:text-muted-foreground min-h-[20px] max-h-32"
            style={{ height: "20px", overflowY: "auto" }}
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim()}
            className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed hover:bg-primary/90 transition-all flex-shrink-0"
          >
            <Icon name="ArrowUp" size={14} className="text-primary-foreground" />
          </button>
        </div>
      </div>
    </div>
  );
}
