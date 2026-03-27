import { useState } from "react";
import Icon from "@/components/ui/icon";
import AgentChat from "@/components/AgentChat";
import FriendsList from "@/components/FriendsList";
import GroupChats from "@/components/GroupChats";
import Profile from "@/components/Profile";

type Tab = "agent" | "friends" | "groups" | "profile";

const TABS = [
  { id: "agent" as Tab, icon: "Sparkles", label: "Агент" },
  { id: "friends" as Tab, icon: "MessageCircle", label: "Друзья" },
  { id: "groups" as Tab, icon: "Users", label: "Группы" },
  { id: "profile" as Tab, icon: "User", label: "Профиль" },
];

export default function Index() {
  const [activeTab, setActiveTab] = useState<Tab>("agent");

  return (
    <div className="flex flex-col h-screen bg-background font-golos max-w-md mx-auto relative">
      <div className="flex-1 overflow-hidden relative">
        <div className={`absolute inset-0 transition-opacity duration-200 ${activeTab === "agent" ? "opacity-100 z-10" : "opacity-0 z-0 pointer-events-none"}`}>
          <AgentChat />
        </div>
        <div className={`absolute inset-0 transition-opacity duration-200 ${activeTab === "friends" ? "opacity-100 z-10" : "opacity-0 z-0 pointer-events-none"}`}>
          <FriendsList />
        </div>
        <div className={`absolute inset-0 transition-opacity duration-200 ${activeTab === "groups" ? "opacity-100 z-10" : "opacity-0 z-0 pointer-events-none"}`}>
          <GroupChats />
        </div>
        <div className={`absolute inset-0 transition-opacity duration-200 ${activeTab === "profile" ? "opacity-100 z-10" : "opacity-0 z-0 pointer-events-none"}`}>
          <Profile />
        </div>
      </div>

      <nav className="flex-shrink-0 border-t border-border bg-background/95 backdrop-blur-sm">
        <div className="flex">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 flex flex-col items-center gap-1 py-3 transition-all ${
                  isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <div className={`relative p-1.5 rounded-xl transition-all ${isActive ? "bg-primary/15" : ""}`}>
                  <Icon name={tab.icon as never} size={20} />
                  {tab.id === "agent" && (
                    <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-emerald-500 rounded-full" />
                  )}
                </div>
                <span className={`text-[11px] font-medium transition-all ${isActive ? "opacity-100" : "opacity-60"}`}>
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
