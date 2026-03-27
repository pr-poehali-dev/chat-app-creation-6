import { useState, useRef, useEffect } from "react";
import Icon from "@/components/ui/icon";
import { sendToAI, type ChatMessage } from "@/lib/ai";
import { loadProfile, loadAISettings } from "@/lib/storage";

interface Message {
  id: string;
  role: "user" | "agent";
  text: string;
  time: string;
}

const FREE_MODELS: Record<string, string> = {
  "deepseek-chat": "DeepSeek V3",
  "mistralai/mistral-7b-instruct:free": "Mistral 7B",
  "meta-llama/llama-3.3-70b-instruct:free": "Llama 3.3 70B",
  "google/gemma-3-27b-it:free": "Gemma 3 27B",
  "deepseek/deepseek-chat-v3-0324:free": "DeepSeek V3",
  "llama-3.3-70b-versatile": "Llama 3.3 70B",
  "llama-3.1-8b-instant": "Llama 3.1 8B",
  "gemma2-9b-it": "Gemma 2 9B",
  "custom": "Свой API",
};

function getModelLabel(modelId: string): string {
  return FREE_MODELS[modelId] ?? modelId.split("/").pop()?.replace(":free", "") ?? modelId;
}

export default function AgentChat() {
  const profile = loadProfile();
  const aiSettings = loadAISettings();

  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      role: "agent",
      text: `Привет${profile.name ? `, ${profile.name}` : ""}! Я твой личный ИИ-агент. Чем могу помочь?`,
      time: new Date().toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit" }),
    },
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // История для API (только role + content, без UI-полей)
  const historyRef = useRef<ChatMessage[]>([]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  const getTime = () =>
    new Date().toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit" });

  const sendMessage = async () => {
    if (!input.trim() || isTyping) return;
    const text = input.trim();
    setInput("");
    setError(null);

    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      text,
      time: getTime(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setIsTyping(true);

    // Добавляем в историю для API
    historyRef.current = [...historyRef.current, { role: "user", content: text }];

    try {
      const reply = await sendToAI(historyRef.current);

      // Сохраняем ответ агента в историю
      historyRef.current = [...historyRef.current, { role: "assistant", content: reply }];

      // Ограничиваем историю — последние 20 сообщений чтобы не раздувать токены
      if (historyRef.current.length > 20) {
        historyRef.current = historyRef.current.slice(-20);
      }

      const agentMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: "agent",
        text: reply,
        time: getTime(),
      };
      setMessages((prev) => [...prev, agentMsg]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Неизвестная ошибка";
      setError(msg);
      // Убираем последнее сообщение пользователя из истории при ошибке
      historyRef.current = historyRef.current.slice(0, -1);
    } finally {
      setIsTyping(false);
    }
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const modelLabel = getModelLabel(aiSettings.modelId);
  const hasKey = !!aiSettings.apiKey;

  return (
    <div className="flex flex-col h-full">
      {/* Хедер */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-border">
        <div className="relative">
          <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center agent-glow">
            <Icon name="Sparkles" size={16} className="text-primary" />
          </div>
          <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full border-2 border-background animate-pulse-dot" />
        </div>
        <div>
          <div className="text-sm font-semibold">{profile.agentName || "Мой агент"}</div>
          <div className="text-xs text-muted-foreground flex items-center gap-1">
            {modelLabel}
            {hasKey ? (
              <span className="text-emerald-400/70">· свой ключ</span>
            ) : (
              <span className="text-muted-foreground/50">· общий доступ</span>
            )}
          </div>
        </div>
        <button
          onClick={() => {
            historyRef.current = [];
            setMessages([{
              id: Date.now().toString(),
              role: "agent",
              text: `Новый разговор начат. Чем могу помочь${profile.name ? `, ${profile.name}` : ""}?`,
              time: getTime(),
            }]);
            setError(null);
          }}
          className="ml-auto text-muted-foreground hover:text-foreground transition-colors"
          title="Начать новый разговор"
        >
          <Icon name="RotateCcw" size={15} />
        </button>
      </div>

      {/* Сообщения */}
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
            <div className={`max-w-[78%] ${msg.role === "user" ? "items-end" : "items-start"} flex flex-col gap-1`}>
              <div
                className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
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

        {/* Ошибка */}
        {error && (
          <div className="flex gap-2 items-start animate-fade-in">
            <div className="w-7 h-7 rounded-full bg-destructive/20 flex items-center justify-center flex-shrink-0 mt-0.5 flex-shrink-0">
              <Icon name="AlertCircle" size={12} className="text-destructive" />
            </div>
            <div className="bg-destructive/10 border border-destructive/20 rounded-2xl rounded-tl-sm px-4 py-2.5 flex-1">
              <p className="text-xs text-destructive/90 leading-relaxed">{error}</p>
              {!aiSettings.apiKey && (
                <p className="text-[11px] text-muted-foreground mt-1.5">
                  Попробуй добавить API-ключ в настройках профиля → Нейросеть.
                </p>
              )}
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Ввод */}
      <div className="px-4 pb-4 pt-2">
        <div className="flex gap-2 items-end bg-card border border-border rounded-2xl px-4 py-2.5 focus-within:border-primary/50 transition-colors">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              e.target.style.height = "20px";
              e.target.style.height = Math.min(e.target.scrollHeight, 128) + "px";
            }}
            onKeyDown={handleKey}
            placeholder="Напиши своему агенту..."
            rows={1}
            className="flex-1 bg-transparent text-sm resize-none outline-none placeholder:text-muted-foreground min-h-[20px] max-h-32"
            style={{ height: "20px" }}
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || isTyping}
            className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed hover:bg-primary/90 transition-all flex-shrink-0"
          >
            <Icon name="ArrowUp" size={14} className="text-primary-foreground" />
          </button>
        </div>
      </div>
    </div>
  );
}
