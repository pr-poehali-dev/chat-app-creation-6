import func2url from '../../backend/func2url.json';

const URLS = func2url as Record<string, string>;

function getToken(): string | null {
  return localStorage.getItem('pino:token');
}

function getHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json', ...extra };
  const t = getToken();
  if (t) h['X-Auth-Token'] = t;
  return h;
}

async function req(fn: string, path: string, method = 'GET', body?: unknown) {
  const url = URLS[fn] + path;
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
      req('auth', '/register', 'POST', b),
    login: (b: { login: string; password: string }) =>
      req('auth', '/login', 'POST', b),
    logout: () => req('auth', '/logout', 'POST'),
    me: () => req('auth', '/me', 'GET'),
    update: (b: Record<string, unknown>) => req('auth', '/me', 'PUT', b),
  },
  contacts: {
    list: (status = 'accepted') => req('contacts', `/contacts?status=${status}`),
    add: (b: { user_id?: string; username?: string }) => req('contacts', '/contacts', 'POST', b),
    respond: (id: string, action: 'accept' | 'reject') =>
      req('contacts', `/contacts/${id}`, 'PUT', { action }),
    search: (q: string) => req('contacts', `/search?q=${encodeURIComponent(q)}`),
  },
  chats: {
    list: (type?: string) => req('chats', `/chats${type ? `?type=${type}` : ''}`),
    create: (b: { type: string; name?: string; members?: string[]; emoji?: string; is_agent_room?: boolean }) =>
      req('chats', '/chats', 'POST', b),
    messages: (chatId: string, limit = 50, offset = 0) =>
      req('chats', `/chats/${chatId}/messages?limit=${limit}&offset=${offset}`),
    send: (chatId: string, content: string) =>
      req('chats', `/chats/${chatId}/messages`, 'POST', { content }),
    members: (chatId: string) => req('chats', `/chats/${chatId}/members`),
    addMember: (chatId: string, userId: string) =>
      req('chats', `/chats/${chatId}/members`, 'POST', { user_id: userId }),
  },
  agent: {
    chat: (message: string, history: { role: string; content: string }[]) =>
      req('agent', '/chat', 'POST', { message, history }),
    memory: () => req('agent', '/memory'),
    saveMemory: (b: { content: string; category: string; level?: string }) =>
      req('agent', '/memory', 'POST', b),
    feedback: (memory_id: string, feedback: 'positive' | 'negative') =>
      req('agent', '/feedback', 'POST', { memory_id, feedback }),
    settings: () => req('agent', '/settings'),
    updateSettings: (b: Record<string, string | boolean>) => req('agent', '/settings', 'PUT', b),
    exportMemory: () => req('agent', '/export'),
    importMemory: (memories: unknown[]) => req('agent', '/import', 'POST', { memories }),
    listAgents: () => req('agent', '/agents'),
    createAgent: (b: Record<string, unknown>) => req('agent', '/agents', 'POST', b),
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
