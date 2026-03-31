import func2url from '../../backend/func2url.json';

const URLS = func2url as Record<string, string>;

function getToken(): string | null {
  return localStorage.getItem('pino:token');
}

function getHeaders(): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  const t = getToken();
  if (t) h['X-Auth-Token'] = t;
  return h;
}

async function req(fn: string, action: string, method = 'GET', body?: unknown, extra: Record<string, string> = {}) {
  const params = new URLSearchParams({ action, ...extra });
  const url = `${URLS[fn]}?${params.toString()}`;
  const res = await fetch(url, {
    method,
    headers: getHeaders(),
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

export const api = {
  auth: {
    register: (b: { username: string; email: string; password: string; display_name?: string }) =>
      req('auth', 'register', 'POST', b),
    login: (b: { login: string; password: string }) =>
      req('auth', 'login', 'POST', b),
    logout: () => req('auth', 'logout', 'POST'),
    me: () => req('auth', 'me', 'GET'),
    update: (b: Record<string, unknown>) => req('auth', 'me', 'PUT', b),
  },
  contacts: {
    list: (status = 'accepted') => req('contacts', 'list', 'GET', undefined, { status }),
    add: (b: { user_id?: string; username?: string }) => req('contacts', 'add', 'POST', b),
    respond: (id: string, action: 'accept' | 'reject') =>
      req('contacts', 'respond', 'PUT', { action }, { id }),
    search: (q: string) => req('contacts', 'search', 'GET', undefined, { q }),
  },
  chats: {
    list: (type?: string) => req('chats', 'list', 'GET', undefined, type ? { type } : {}),
    create: (b: { type: string; name?: string; members?: string[]; emoji?: string; is_agent_room?: boolean }) =>
      req('chats', 'create', 'POST', b),
    messages: (chatId: string, limit = 50, offset = 0) =>
      req('chats', 'messages', 'GET', undefined, { chat_id: chatId, limit: String(limit), offset: String(offset) }),
    send: (chatId: string, content: string) =>
      req('chats', 'send', 'POST', { content }, { chat_id: chatId }),
    members: (chatId: string) => req('chats', 'members', 'GET', undefined, { chat_id: chatId }),
    addMember: (chatId: string, userId: string) =>
      req('chats', 'add_member', 'POST', { user_id: userId }, { chat_id: chatId }),
  },
  agent: {
    chat: (message: string, history: { role: string; content: string }[]) =>
      req('agent', 'chat', 'POST', { message, history }),
    memory: () => req('agent', 'memory', 'GET'),
    saveMemory: (b: { content: string; category: string; level?: string }) =>
      req('agent', 'save_memory', 'POST', b),
    feedback: (memory_id: string, feedback: 'positive' | 'negative') =>
      req('agent', 'feedback', 'POST', { memory_id, feedback }),
    settings: () => req('agent', 'settings', 'GET'),
    updateSettings: (b: Record<string, string | boolean>) => req('agent', 'settings', 'PUT', b),
    exportMemory: () => req('agent', 'export', 'GET'),
    importMemory: (memories: unknown[]) => req('agent', 'import', 'POST', { memories }),
    listAgents: () => req('agent', 'list_agents', 'GET'),
    createAgent: (b: Record<string, unknown>) => req('agent', 'create_agent', 'POST', b),
  },
};

export function saveToken(token: string) {
  localStorage.setItem('pino:token', token);
}
export function clearToken() {
  localStorage.removeItem('pino:token');
}
export function isLoggedIn(): boolean {
  return !!getToken();
}
