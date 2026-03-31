import { useState } from 'react';
import { api, saveToken } from '@/lib/api';

interface AuthProps {
  onLogin: () => void;
}

export default function Auth({ onLogin }: AuthProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [loginForm, setLoginForm] = useState({ login: '', password: '' });
  const [regForm, setRegForm] = useState({ username: '', display_name: '', email: '', password: '' });

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const data = await api.auth.login(loginForm);
      saveToken(data.token);
      onLogin();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Ошибка входа');
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const data = await api.auth.register(regForm);
      saveToken(data.token);
      onLogin();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Ошибка регистрации');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center mx-auto mb-3">
            <span className="text-3xl">🌿</span>
          </div>
          <h1 className="text-2xl font-bold text-foreground">Пино</h1>
          <p className="text-muted-foreground text-sm mt-1">Мессенджер с живым AI</p>
        </div>

        <div className="flex rounded-xl overflow-hidden border border-border mb-6">
          <button
            onClick={() => setMode('login')}
            className={`flex-1 py-2.5 text-sm font-medium transition-colors ${mode === 'login' ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:text-foreground'}`}
          >Войти</button>
          <button
            onClick={() => setMode('register')}
            className={`flex-1 py-2.5 text-sm font-medium transition-colors ${mode === 'register' ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:text-foreground'}`}
          >Регистрация</button>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm">{error}</div>
        )}

        {mode === 'login' ? (
          <form onSubmit={handleLogin} className="space-y-3">
            <input
              type="text"
              placeholder="Логин или email"
              value={loginForm.login}
              onChange={e => setLoginForm(f => ({ ...f, login: e.target.value }))}
              className="w-full bg-card border border-border rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
              required
            />
            <input
              type="password"
              placeholder="Пароль"
              value={loginForm.password}
              onChange={e => setLoginForm(f => ({ ...f, password: e.target.value }))}
              className="w-full bg-card border border-border rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
              required
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
            >{loading ? 'Входим...' : 'Войти'}</button>
          </form>
        ) : (
          <form onSubmit={handleRegister} className="space-y-3">
            <input
              type="text"
              placeholder="Имя пользователя (латиница)"
              value={regForm.username}
              onChange={e => setRegForm(f => ({ ...f, username: e.target.value }))}
              className="w-full bg-card border border-border rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
              required
            />
            <input
              type="text"
              placeholder="Отображаемое имя"
              value={regForm.display_name}
              onChange={e => setRegForm(f => ({ ...f, display_name: e.target.value }))}
              className="w-full bg-card border border-border rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
            <input
              type="email"
              placeholder="Email"
              value={regForm.email}
              onChange={e => setRegForm(f => ({ ...f, email: e.target.value }))}
              className="w-full bg-card border border-border rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
              required
            />
            <input
              type="password"
              placeholder="Пароль (мин. 6 символов)"
              value={regForm.password}
              onChange={e => setRegForm(f => ({ ...f, password: e.target.value }))}
              className="w-full bg-card border border-border rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
              required
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
            >{loading ? 'Создаём...' : 'Создать аккаунт'}</button>
          </form>
        )}
      </div>
    </div>
  );
}
