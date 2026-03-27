// Универсальный клиент нейросети — работает напрямую из браузера
// Поддерживает DeepSeek, OpenRouter, Groq и любой OpenAI-совместимый API

import { loadAISettings, loadMemory, loadProfile, appendToMemorySection } from "@/lib/storage";
import type { AgentMemory } from "@/lib/storage";

export interface MemoryUpdate {
  section: keyof AgentMemory;
  text: string;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

// Маппинг модели → endpoint
const MODEL_ENDPOINTS: Record<string, string> = {
  // DeepSeek
  "deepseek-chat": "https://api.deepseek.com/v1/chat/completions",
  "deepseek-reasoner": "https://api.deepseek.com/v1/chat/completions",
  // Groq
  "llama-3.3-70b-versatile": "https://api.groq.com/openai/v1/chat/completions",
  "llama-3.1-8b-instant": "https://api.groq.com/openai/v1/chat/completions",
  "gemma2-9b-it": "https://api.groq.com/openai/v1/chat/completions",
  // OpenRouter — все остальные (с :free и без)
};

function getEndpoint(modelId: string, customEndpoint: string): string {
  if (modelId === "custom") return customEndpoint || "https://api.openai.com/v1/chat/completions";
  return MODEL_ENDPOINTS[modelId] ?? "https://openrouter.ai/api/v1/chat/completions";
}

// Бесплатные ключи для работы без регистрации (через общий прокси OpenRouter)
const FREE_OPENROUTER_KEY = "";

function getApiKey(modelId: string, userKey: string): string {
  if (userKey) return userKey;
  // Для бесплатных OpenRouter-моделей можно работать без ключа через публичный API
  if (modelId.includes(":free") || FREE_OPENROUTER_KEY) return FREE_OPENROUTER_KEY;
  return "";
}

/** Собирает системный промпт из памяти агента */
export function buildSystemPrompt(): string {
  const profile = loadProfile();
  const memory = loadMemory();

  const parts: string[] = [];

  parts.push(
    `Ты — личный ИИ-агент пользователя по имени ${profile.agentName || "Агент"}. ` +
    `Ты общаешься только с этим пользователем. Отвечай по-русски, дружелюбно и по делу. ` +
    `Помни всё, что он тебе рассказывает — это важно для помощи в будущем.`
  );

  if (profile.name) parts.push(`Имя пользователя: ${profile.name}.`);

  if (memory.personal) parts.push(`\n## Личное\n${memory.personal}`);
  if (memory.interests) parts.push(`\n## Интересы\n${memory.interests}`);
  if (memory.work) parts.push(`\n## Работа\n${memory.work}`);
  if (memory.social) parts.push(`\n## Социальное\n${memory.social}`);
  // private — тоже передаём агенту (он же разговаривает только с владельцем)
  if (memory.private) parts.push(`\n## Личные заметки (только для тебя)\n${memory.private}`);

  parts.push(
    `\nЕсли пользователь рассказывает что-то новое о себе — запоминай это в контексте разговора. ` +
    `Не повторяй одни и те же вопросы. Будь кратким, если не просят развёрнутого ответа.`
  );

  return parts.join("\n");
}

/**
 * Анализирует последний обмен и извлекает факты для записи в память.
 * Возвращает массив обновлений или пустой массив, если нечего запоминать.
 */
export async function extractMemoryFacts(
  userMessage: string,
  agentReply: string
): Promise<MemoryUpdate[]> {
  const settings = loadAISettings();
  const { modelId, apiKey, customEndpoint, customModelName } = settings;
  const endpoint = getEndpoint(modelId, customEndpoint);
  const key = getApiKey(modelId, apiKey);
  const model = modelId === "custom" ? customModelName : modelId;

  const prompt = `Проанализируй следующий диалог и выдели только НОВЫЕ факты о пользователе, которые стоит запомнить в долгосрочной памяти.

Пользователь написал: "${userMessage}"
Агент ответил: "${agentReply}"

Распредели факты по категориям:
- personal: личные данные (имя, возраст, город, семья, здоровье)
- interests: хобби, увлечения, интересы
- work: работа, профессия, бизнес, проекты
- social: друзья, знакомые, социальные связи
- private: цели, мечты, страхи, важные переживания

Ответь ТОЛЬКО в формате JSON (без markdown, без пояснений):
{"updates": [{"section": "personal", "text": "факт для запоминания"}, ...]}

Если новых фактов нет — верни: {"updates": []}
Каждый факт — короткое утверждение (до 20 слов). Не дублируй то, что уже известно.`;

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (key) headers["Authorization"] = `Bearer ${key}`;
  if (endpoint.includes("openrouter")) {
    headers["HTTP-Referer"] = window.location.origin;
    headers["X-Title"] = "Личный агент";
  }

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt }],
        max_tokens: 512,
        temperature: 0.1,
      }),
    });
    if (!res.ok) return [];
    const data = await res.json();
    const raw = data?.choices?.[0]?.message?.content?.trim() ?? "";
    // Пробуем распарсить JSON — иногда модель добавляет ```json обёртку
    const jsonStr = raw.replace(/```json\n?|\n?```/g, "").trim();
    const parsed = JSON.parse(jsonStr);
    const updates: MemoryUpdate[] = parsed?.updates ?? [];
    // Сохраняем сразу в localStorage
    for (const upd of updates) {
      if (upd.section && upd.text) {
        appendToMemorySection(upd.section as keyof AgentMemory, upd.text);
      }
    }
    return updates;
  } catch {
    return [];
  }
}

/** Основная функция — отправляет историю сообщений и возвращает ответ агента */
export async function sendToAI(history: ChatMessage[]): Promise<string> {
  const settings = loadAISettings();
  const { modelId, apiKey, customEndpoint, customModelName } = settings;

  const endpoint = getEndpoint(modelId, customEndpoint);
  const key = getApiKey(modelId, apiKey);
  const model = modelId === "custom" ? customModelName : modelId;

  const systemPrompt = buildSystemPrompt();
  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    ...history,
  ];

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (key) headers["Authorization"] = `Bearer ${key}`;

  // OpenRouter требует дополнительные заголовки
  if (endpoint.includes("openrouter")) {
    headers["HTTP-Referer"] = window.location.origin;
    headers["X-Title"] = "Личный агент";
  }

  const res = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model,
      messages,
      max_tokens: 1024,
      temperature: 0.7,
    }),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => res.statusText);
    throw new Error(`Ошибка API (${res.status}): ${err}`);
  }

  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error("Пустой ответ от нейросети");
  return text.trim();
}