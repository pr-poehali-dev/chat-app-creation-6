// Хранилище данных агента на устройстве пользователя
// Каждый раздел хранится отдельно — агент может читать и писать в любой из них

export interface ProfileData {
  name: string;
  age: string;
  city: string;
  occupation: string;
  interests: string[];
  agentName: string;
}

export interface AgentMemory {
  personal: string;
  interests: string;
  work: string;
  social: string;
  private: string;
}

export interface AISettings {
  modelId: string;
  apiKey: string;
  customEndpoint: string;
  customModelName: string;
}

export interface PrivacySettings {
  [key: string]: "public" | "request" | "private";
}

const KEYS = {
  profile: "agent:profile",
  memory: {
    personal: "agent:memory:personal",
    interests: "agent:memory:interests",
    work: "agent:memory:work",
    social: "agent:memory:social",
    private: "agent:memory:private",
  },
  ai: "agent:ai",
  privacy: "agent:privacy",
} as const;

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function write<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // localStorage недоступен (приватный режим или квота)
  }
}

// --- Профиль ---

export const DEFAULT_PROFILE: ProfileData = {
  name: "", age: "", city: "", occupation: "", interests: [], agentName: "Мой агент",
};

export function loadProfile(): ProfileData {
  return read(KEYS.profile, DEFAULT_PROFILE);
}

export function saveProfile(data: ProfileData): void {
  write(KEYS.profile, data);
}

// --- Память агента (каждый раздел отдельно) ---

export const DEFAULT_MEMORY: AgentMemory = {
  personal: "", interests: "", work: "", social: "", private: "",
};

export function loadMemory(): AgentMemory {
  return {
    personal: read(KEYS.memory.personal, ""),
    interests: read(KEYS.memory.interests, ""),
    work: read(KEYS.memory.work, ""),
    social: read(KEYS.memory.social, ""),
    private: read(KEYS.memory.private, ""),
  };
}

export function saveMemorySection(section: keyof AgentMemory, value: string): void {
  write(KEYS.memory[section], value);
}

export function saveMemory(memory: AgentMemory): void {
  (Object.keys(memory) as Array<keyof AgentMemory>).forEach((key) => {
    write(KEYS.memory[key], memory[key]);
  });
}

/** Читает конкретный раздел памяти — агент вызывает это чтобы узнать о пользователе */
export function readMemorySection(section: keyof AgentMemory): string {
  return read(KEYS.memory[section], "");
}

/** Дописывает информацию в раздел памяти — агент вызывает это после разговора */
export function appendToMemorySection(section: keyof AgentMemory, text: string): void {
  const current = read<string>(KEYS.memory[section], "");
  const updated = current ? `${current}\n${text}` : text;
  write(KEYS.memory[section], updated);
}

// --- Настройки нейросети ---

export const DEFAULT_AI: AISettings = {
  modelId: "deepseek-chat", apiKey: "", customEndpoint: "", customModelName: "",
};

export function loadAISettings(): AISettings {
  return read(KEYS.ai, DEFAULT_AI);
}

export function saveAISettings(settings: AISettings): void {
  write(KEYS.ai, settings);
}

// --- Приватность ---

export const DEFAULT_PRIVACY: PrivacySettings = {
  personal: "request", social: "request", work: "request", interests: "public", contacts: "private",
};

export function loadPrivacy(): PrivacySettings {
  return read(KEYS.privacy, DEFAULT_PRIVACY);
}

export function savePrivacy(privacy: PrivacySettings): void {
  write(KEYS.privacy, privacy);
}

// --- Хелпер: собрать публичный контекст для агента ---
// Агент использует это чтобы знать, что он может рассказать другим

export function getPublicAgentContext(privacy: PrivacySettings): Partial<AgentMemory> {
  const memory = loadMemory();
  const context: Partial<AgentMemory> = {};
  const sectionMap: Record<string, keyof AgentMemory> = {
    personal: "personal", social: "social", work: "work", interests: "interests",
  };
  Object.entries(sectionMap).forEach(([privacyKey, memoryKey]) => {
    if (privacy[privacyKey] === "public") {
      context[memoryKey] = memory[memoryKey];
    }
  });
  return context;
}
