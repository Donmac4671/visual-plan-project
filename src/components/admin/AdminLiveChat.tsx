import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Send, Search, MessageCircle, Paperclip, Plus, X } from "lucide-react";
import { format } from "date-fns";
import ChatMedia from "@/components/chat/ChatMedia";


interface ChatThread {
  user_id: string;
  full_name: string;
  email: string;
  last_message: string;
  last_at: string;
  unread: number;
}

export default function AdminLiveChat() {
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMsg, setNewMsg] = useState("");
  const [sending, setSending] = useState(false);
  const [search, setSearch] = useState("");
  const [uploading, setUploading] = useState(false);
  const [showNewChat, setShowNewChat] = useState(false);
  const [userSearch, setUserSearch] = useState("");
  const [userResults, setUserResults] = useState<Array<{ user_id: string; full_name: string; email: string; phone: string }>>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!showNewChat) return;
    const q = userSearch.trim();
    const handle = setTimeout(async () => {
      let query = supabase.from("profiles").select("user_id, full_name, email, phone").limit(30);
      if (q) {
        query = query.or(`full_name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%`);
      }
      const { data } = await query.order("created_at", { ascending: false });
      setUserResults(data || []);
    }, 250);
    return () => clearTimeout(handle);
  }, [userSearch, showNewChat]);


  useEffect(() => {
    fetchThreads();

    const channel = supabase
      .channel("admin-chat")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages" }, () => {
        fetchThreads();
        if (selectedUser) fetchMessages(selectedUser);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [selectedUser]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const fetchThreads = async () => {
    const { data: allMessages } = await supabase
      .from("chat_messages")
      .select("*")
      .order("created_at", { ascending: false });

    if (!allMessages) return;

    const userIds = [...new Set(allMessages.map((m) => m.user_id))];
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, full_name, email")
      .in("user_id", userIds);

    const profileMap = new Map(profiles?.map((p) => [p.user_id, p]) || []);

    const threadMap = new Map<string, ChatThread>();
    for (const msg of allMessages) {
      if (!threadMap.has(msg.user_id)) {
        const profile = profileMap.get(msg.user_id);
        threadMap.set(msg.user_id, {
          user_id: msg.user_id,
          full_name: profile?.full_name || "Unknown",
          email: profile?.email || "",
          last_message: msg.message,
          last_at: msg.created_at,
          unread: 0,
        });
      }
      if (msg.sender_role === "user" && !msg.is_read) {
        const t = threadMap.get(msg.user_id)!;
        t.unread++;
      }
    }

    setThreads(Array.from(threadMap.values()).sort((a, b) => new Date(b.last_at).getTime() - new Date(a.last_at).getTime()));
  };

  const fetchMessages = async (userId: string) => {
    const { data } = await supabase
      .from("chat_messages")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: true });
    if (data) setMessages(data);

    await supabase
      .from("chat_messages")
      .update({ is_read: true })
      .eq("user_id", userId)
      .eq("sender_role", "user")
      .eq("is_read", false);
  };

  const selectThread = (userId: string) => {
    setSelectedUser(userId);
    fetchMessages(userId);
  };

  const sendReply = async (mediaUrl?: string) => {
    if ((!newMsg.trim() && !mediaUrl) || !selectedUser || sending) return;
    setSending(true);
    await supabase.from("chat_messages").insert({
      user_id: selectedUser,
      message: newMsg.trim() || (mediaUrl ? "📎 Media" : ""),
      sender_role: "admin",
      media_url: mediaUrl || null,
    });
    setNewMsg("");
    setSending(false);
    fetchMessages(selectedUser);
    fetchThreads();
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedUser) return;
    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `admin/${selectedUser}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("chat-media").upload(path, file);
    if (!error) {
      // Store the storage path; signed URLs are generated on render.
      await sendReply(path);
    }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  const isImage = (url: string) => /\.(jpg|jpeg|png|gif|webp|svg)(\?|$)/i.test(url);

  const filteredThreads = threads.filter(
    (t) =>
      t.full_name.toLowerCase().includes(search.toLowerCase()) ||
      t.email.toLowerCase().includes(search.toLowerCase())
  );

  const [selectedProfile, setSelectedProfile] = useState<{ user_id: string; full_name: string; email: string } | null>(null);
  useEffect(() => {
    if (!selectedUser) { setSelectedProfile(null); return; }
    const t = threads.find((x) => x.user_id === selectedUser);
    if (t) { setSelectedProfile({ user_id: t.user_id, full_name: t.full_name, email: t.email }); return; }
    supabase.from("profiles").select("user_id, full_name, email").eq("user_id", selectedUser).maybeSingle().then(({ data }) => {
      if (data) setSelectedProfile(data as any);
    });
  }, [selectedUser, threads]);

  const startChatWith = (u: { user_id: string; full_name: string; email: string }) => {
    setShowNewChat(false);
    setUserSearch("");
    setSelectedProfile(u);
    setSelectedUser(u.user_id);
    fetchMessages(u.user_id);
  };

  return (
    <div className="relative flex h-[500px] border border-border rounded-xl overflow-hidden bg-card">
      {/* Thread list */}
      <div className="w-1/3 border-r border-border flex flex-col">
        <div className="p-2 border-b border-border flex gap-1.5">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8 text-sm h-9" />
          </div>
          <Button size="icon" variant="outline" className="h-9 w-9 shrink-0" onClick={() => setShowNewChat(true)} title="Message a user">
            <Plus className="w-4 h-4" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {filteredThreads.length === 0 && (
            <p className="text-center text-muted-foreground text-xs mt-8">No conversations yet</p>
          )}
          {filteredThreads.map((t) => (
            <button
              key={t.user_id}
              onClick={() => selectThread(t.user_id)}
              className={`w-full text-left px-3 py-2.5 border-b border-border hover:bg-muted/50 transition-colors ${
                selectedUser === t.user_id ? "bg-muted" : ""
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-sm truncate">{t.full_name}</span>
                {t.unread > 0 && (
                  <Badge variant="destructive" className="text-[10px] px-1.5 py-0 min-w-[18px] justify-center">
                    {t.unread}
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground truncate mt-0.5">{t.last_message}</p>
              <p className="text-[10px] text-muted-foreground">{format(new Date(t.last_at), "MMM d, h:mm a")}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1 flex flex-col">
        {!selectedUser ? (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <MessageCircle className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Select a conversation</p>
            </div>
          </div>
        ) : (
          <>
            <div className="px-4 py-2.5 border-b border-border bg-muted/30">
              <p className="font-semibold text-sm">{selectedProfile?.full_name}</p>
              <p className="text-xs text-muted-foreground">{selectedProfile?.email}</p>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {messages.map((m) => (
                <div key={m.id} className={`flex ${m.sender_role === "admin" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[75%] px-3 py-2 rounded-xl text-sm ${
                      m.sender_role === "admin"
                        ? "bg-primary text-primary-foreground rounded-br-sm"
                        : "bg-muted text-foreground rounded-bl-sm"
                    }`}
                  >
                    {m.media_url && <ChatMedia value={m.media_url} />}
                    {m.message && m.message !== "📎 Media" && (
                      <p className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{m.message}</p>
                    )}
                    <p className={`text-[10px] mt-1 ${m.sender_role === "admin" ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                      {format(new Date(m.created_at), "h:mm a")}
                    </p>
                  </div>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>
            <div className="p-2 border-t border-border flex gap-1.5 items-center">
              <input ref={fileRef} type="file" accept="image/*,video/*,.pdf,.doc,.docx" className="hidden" onChange={handleFileUpload} />
              <Button size="icon" variant="ghost" className="shrink-0 h-9 w-9" onClick={() => fileRef.current?.click()} disabled={uploading}>
                <Paperclip className="w-4 h-4" />
              </Button>
              <Input
                value={newMsg}
                onChange={(e) => setNewMsg(e.target.value)}
                placeholder={uploading ? "Uploading..." : "Type a reply..."}
                className="text-sm h-9"
                onKeyDown={(e) => e.key === "Enter" && sendReply()}
                disabled={uploading}
              />
              <Button size="icon" className="shrink-0 h-9 w-9" onClick={() => sendReply()} disabled={sending || uploading || !newMsg.trim()}>
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </>
        )}
      </div>

      {showNewChat && (
        <div className="absolute inset-0 z-50 bg-background/95 flex items-center justify-center p-4" onClick={() => setShowNewChat(false)}>
          <div className="bg-card border border-border rounded-xl w-full max-w-md max-h-[80vh] flex flex-col shadow-lg" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-3 border-b border-border">
              <p className="font-semibold text-sm">Message a user</p>
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setShowNewChat(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
            <div className="p-2 border-b border-border">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input autoFocus placeholder="Search by name, email or phone..." value={userSearch} onChange={(e) => setUserSearch(e.target.value)} className="pl-8 text-sm h-9" />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {userResults.length === 0 && (
                <p className="text-center text-muted-foreground text-xs mt-8 px-3">No users found</p>
              )}
              {userResults.map((u) => (
                <button
                  key={u.user_id}
                  onClick={() => startChatWith(u)}
                  className="w-full text-left px-3 py-2.5 border-b border-border hover:bg-muted/50 transition-colors"
                >
                  <p className="font-medium text-sm truncate">{u.full_name || "Unnamed"}</p>
                  <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                  {u.phone && <p className="text-[10px] text-muted-foreground">{u.phone}</p>}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

