import { useState, useEffect } from 'react';
import { api, isLoggedIn, clearToken } from '@/lib/api';
import Auth from '@/pages/Auth';
import AgentChat from '@/components/AgentChat';
import DirectChats from '@/components/DirectChats';
import FriendsList from '@/components/FriendsList';
import GroupChats from '@/components/GroupChats';
import Profile from '@/components/Profile';
import Icon from '@/components/ui/icon';

type Tab = 'agent' | 'chats' | 'friends' | 'groups' | 'profile';

export default function Index() {
  const [loggedIn, setLoggedIn] = useState(isLoggedIn());
  const [activeTab, setActiveTab] = useState<Tab>('agent');
  const [userId, setUserId] = useState('');

  useEffect(() => {
    if (loggedIn) {
      api.auth.me().then(d => setUserId(d.user?.id || '')).catch(() => {
        clearToken();
        setLoggedIn(false);
      });
    }
  }, [loggedIn]);

  if (!loggedIn) {
    return <Auth onLogin={() => setLoggedIn(true)} />;
  }

  const tabs: { id: Tab; icon: string; label: string }[] = [
    { id: 'agent', icon: 'Sparkles', label: 'Пино' },
    { id: 'chats', icon: 'MessageCircle', label: 'Чаты' },
    { id: 'friends', icon: 'Users', label: 'Друзья' },
    { id: 'groups', icon: 'UsersRound', label: 'Группы' },
    { id: 'profile', icon: 'User', label: 'Профиль' },
  ];

  return (
    <div className="min-h-screen bg-background flex items-center justify-center" style={{ fontFamily: "'Golos Text', sans-serif" }}>
      <div className="w-full max-w-md h-screen md:h-[760px] md:rounded-3xl md:shadow-2xl bg-background border border-border/50 flex flex-col overflow-hidden relative">

        <div className="flex-1 overflow-hidden relative">
          {tabs.map(t => (
            <div
              key={t.id}
              className={`absolute inset-0 transition-opacity duration-200 ${activeTab === t.id ? 'opacity-100 pointer-events-auto z-10' : 'opacity-0 pointer-events-none z-0'}`}
            >
              {t.id === 'agent' && <AgentChat />}
              {t.id === 'chats' && userId && <DirectChats currentUserId={userId} />}
              {t.id === 'friends' && <FriendsList />}
              {t.id === 'groups' && userId && <GroupChats currentUserId={userId} />}
              {t.id === 'profile' && <Profile onLogout={() => { setLoggedIn(false); setActiveTab('agent'); }} />}
            </div>
          ))}
        </div>

        <div className="flex border-t border-border bg-card/80 backdrop-blur-sm">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex-1 flex flex-col items-center justify-center py-2.5 gap-1 transition-colors relative ${
                activeTab === t.id ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {t.id === 'agent' && activeTab !== 'agent' && (
                <span className="absolute top-2 right-[calc(50%-8px)] w-2 h-2 bg-emerald-500 rounded-full" />
              )}
              <Icon name={t.icon} size={18} />
              <span className="text-[10px] font-medium">{t.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
