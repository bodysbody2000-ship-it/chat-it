import { useEffect, useState, useRef, useCallback } from "react";
import { useLocation, Link } from "wouter";
import { useSendMessage } from "@workspace/api-client-react";
import type { Message } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Send, Image as ImageIcon, Smile, KeyRound, LogOut, Loader2, ShieldCheck } from "lucide-react";
import { format } from "date-fns";
import { playSend, playReceive } from "../lib/sounds";

const COMMON_EMOJIS = [
  "😀","😂","🤣","😊","😍","🥰","😎","🤩","😘","😗",
  "😋","😛","😜","🤪","😝","🤑","🤗","🤭","🤫","🤔",
  "🤐","🤨","😐","😑","😶","😏","😒","🙄","😬","🤥",
  "😌","😔","😪","🤤","😴","😷","🤒","🤕","🤢","🤮",
  "🤧","🥵","🥶","🥴","😵","🤯","🤠","🥳","❤️","👍",
];

export default function Chat() {
  const [, setLocation] = useLocation();
  const [username, setUsername] = useState("");
  const [showUsernamePrompt, setShowUsernamePrompt] = useState(false);
  const [tempUsername, setTempUsername] = useState("");
  const [isConnected, setIsConnected] = useState(true);

  const [inputValue, setInputValue] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);

  // IDs of messages that should play the pop-in animation
  const [newMsgIds, setNewMsgIds] = useState<Set<number>>(new Set());
  // IDs known on first load — don't animate these
  const seenOnLoad = useRef<Set<number>>(new Set());
  const isFirstLoad = useRef(true);

  // Send button rocket animation state
  const [sendAnimating, setSendAnimating] = useState(false);
  // Input flash state
  const [inputFlash, setInputFlash] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sendBtnRef = useRef<HTMLButtonElement>(null);

  const sendMessageMutation = useSendMessage();

  // ===== جلب الرسائل =====
  const fetchMessages = useCallback(async () => {
    const token = localStorage.getItem("chat_token");
    if (!token) return;
    try {
      const res = await fetch("/api/messages?limit=50", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        if (res.status === 401) {
          localStorage.removeItem("chat_token");
          setLocation("/");
        }
        return;
      }
      const data: Message[] = await res.json();

      setMessages((prev) => {
        // On first load, mark all current IDs as "old" — no animation
        if (isFirstLoad.current) {
          isFirstLoad.current = false;
          data.forEach((m) => seenOnLoad.current.add(m.id));
          return data;
        }

        // Find truly new messages
        const prevIds = new Set(prev.map((m) => m.id));
        const incoming = data.filter((m) => !prevIds.has(m.id) && !seenOnLoad.current.has(m.id));

        if (incoming.length > 0) {
          const incomingIds = new Set(incoming.map((m) => m.id));
          setNewMsgIds((old) => {
            const next = new Set(old);
            incoming.forEach((m) => next.add(m.id));
            return next;
          });
          // Remove animation class after it plays (220ms)
          setTimeout(() => {
            setNewMsgIds((old) => {
              const next = new Set(old);
              incomingIds.forEach((id) => next.delete(id));
              return next;
            });
          }, 400);

          // Play receive sound only for messages from others
          const currentUser = localStorage.getItem("chat_username") ?? "";
          const fromOthers = incoming.some((m) => m.username !== currentUser);
          if (fromOthers) playReceive();
        }

        return data;
      });

      setIsConnected(true);
    } catch {
      setIsConnected(false);
    } finally {
      setIsLoading(false);
    }
  }, [setLocation]);

  // ===== جلب من يكتب =====
  const fetchTyping = useCallback(async () => {
    const token = localStorage.getItem("chat_token");
    if (!token) return;
    try {
      const res = await fetch("/api/typing", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data: { typing: string[] } = await res.json();
      const currentUsername = localStorage.getItem("chat_username") ?? "";
      setTypingUsers(data.typing.filter((u) => u !== currentUsername));
    } catch { /* silent */ }
  }, []);

  // ===== إرسال إشارة الكتابة =====
  const sendTypingSignal = useCallback(async () => {
    const token = localStorage.getItem("chat_token");
    const uname = localStorage.getItem("chat_username");
    if (!token || !uname) return;
    try {
      await fetch("/api/typing", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username: uname }),
      });
    } catch { /* silent */ }
  }, []);

  // ===== Auth check =====
  useEffect(() => {
    const token = localStorage.getItem("chat_token");
    if (!token) { setLocation("/"); return; }
    const storedUsername = localStorage.getItem("chat_username");
    if (!storedUsername) {
      setShowUsernamePrompt(true);
    } else {
      setUsername(storedUsername);
    }
  }, [setLocation]);

  // ===== Polling =====
  useEffect(() => {
    if (!username) return;
    fetchMessages();
    fetchTyping();
    const mInt = setInterval(fetchMessages, 3000);
    const tInt = setInterval(fetchTyping, 2000);
    return () => { clearInterval(mInt); clearInterval(tInt); };
  }, [username, fetchMessages, fetchTyping]);

  // ===== Auto-scroll on new messages =====
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    }
  }, [messages.length]);

  const handleSaveUsername = () => {
    if (tempUsername.trim().length > 0) {
      const name = tempUsername.trim();
      localStorage.setItem("chat_username", name);
      setUsername(name);
      setShowUsernamePrompt(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
    sendTypingSignal();
  };

  const triggerSendAnimation = () => {
    // Flash the input
    setInputFlash(true);
    setTimeout(() => setInputFlash(false), 400);

    // Rocket the button
    setSendAnimating(false);
    void sendBtnRef.current?.offsetWidth;
    setSendAnimating(true);
    setTimeout(() => setSendAnimating(false), 320);

    // Whoosh sound
    playSend();
  };

  const handleSendMessage = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputValue.trim() || sendMessageMutation.isPending) return;

    const textToSend = inputValue.trim();
    setInputValue(""); // instant clear — feels snappy
    triggerSendAnimation();

    // Optimistic: add message locally before server responds
    const optimisticId = -Date.now();
    const optimisticMsg: Message = {
      id: optimisticId,
      content: textToSend,
      type: "text",
      username,
      imageUrl: null,
      createdAt: new Date().toISOString(),
    };
    seenOnLoad.current.add(optimisticId); // don't re-animate from server
    setMessages((prev) => [...prev, optimisticMsg]);
    // Animate the optimistic bubble (it IS new — our own send)
    setNewMsgIds((old) => { const next = new Set(old); next.add(optimisticId); return next; });
    setTimeout(() => setNewMsgIds((old) => { const next = new Set(old); next.delete(optimisticId); return next; }), 400);

    sendMessageMutation.mutate(
      { data: { content: textToSend, type: "text", username } },
      {
        onSuccess: (realMsg) => {
          seenOnLoad.current.add(realMsg.id);
          setMessages((prev) =>
            prev.map((m) => (m.id === optimisticId ? realMsg : m))
          );
        },
        onError: () => {
          // Remove optimistic message on error
          setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
        },
      }
    );
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const token = localStorage.getItem("chat_token");
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (res.ok) {
        const data = await res.json();
        triggerSendAnimation();
        sendMessageMutation.mutate({
          data: { content: "صورة", type: "image", username, imageUrl: data.url },
        });
      }
    } catch { /* silent */ }
    finally { if (fileInputRef.current) fileInputRef.current.value = ""; }
  };

  const handleLogout = () => {
    localStorage.removeItem("chat_token");
    localStorage.removeItem("chat_username");
    setLocation("/");
  };

  if (showUsernamePrompt) {
    return (
      <Dialog open={true}>
        <DialogContent className="sm:max-w-sm [&>button]:hidden mx-4">
          <DialogHeader>
            <DialogTitle>ما اسمك؟</DialogTitle>
            <DialogDescription>اختار اسم يظهر للناس في الشات</DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2 mt-4">
            <Input
              value={tempUsername}
              onChange={(e) => setTempUsername(e.target.value)}
              placeholder="مثال: أحمد"
              onKeyDown={(e) => { if (e.key === "Enter") handleSaveUsername(); }}
            />
            <Button onClick={handleSaveUsername} disabled={!tempUsername.trim()}>تأكيد</Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const typingText =
    typingUsers.length === 0 ? null
    : typingUsers.length === 1 ? `${typingUsers[0]} يكتب...`
    : typingUsers.length === 2 ? `${typingUsers[0]} و ${typingUsers[1]} يكتبان...`
    : `${typingUsers.slice(0, 2).join(" و ")} وآخرون يكتبون...`;

  return (
    <div style={{ height: "100dvh" }} className="flex flex-col bg-background text-foreground overflow-hidden">

      {/* ── Header ── */}
      <header className="flex items-center justify-between px-3 py-2.5 border-b border-border/50 bg-card/50 backdrop-blur-sm shrink-0 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <h1 className="text-base font-bold text-primary shrink-0">Chat</h1>
          <div className="flex items-center gap-1 bg-primary/10 border border-primary/20 rounded-full px-2 py-0.5 shrink-0">
            <ShieldCheck className="w-3 h-3 text-primary" />
            <span className="text-[10px] text-primary font-medium whitespace-nowrap">Totally Encrypted</span>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <span className="relative flex h-2 w-2">
              {isConnected && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />}
              <span className={`relative inline-flex rounded-full h-2 w-2 ${isConnected ? "bg-primary" : "bg-muted-foreground"}`} />
            </span>
            <span className={`text-[10px] hidden sm:inline ${isConnected ? "text-primary" : "text-muted-foreground"}`}>
              {isConnected ? "متصل" : "غير متصل"}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <Link href="/apikeys" className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors px-2 py-1 rounded-md hover:bg-secondary/50">
            <KeyRound className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">API Keys</span>
          </Link>
          <div className="h-3.5 w-px bg-border" />
          <span className="text-xs font-medium text-primary/70 max-w-[60px] truncate">{username}</span>
          <Button variant="ghost" size="icon" onClick={handleLogout} className="h-7 w-7 text-muted-foreground hover:text-destructive">
            <LogOut className="w-3.5 h-3.5" />
          </Button>
        </div>
      </header>

      {/* ── Messages ── */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-4 space-y-3">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-7 h-7 text-primary animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm text-center px-4">
            لا توجد رسائل بعد. ابدأ المحادثة!
          </div>
        ) : (
          messages.map((msg, i) => {
            const isMe = msg.username === username;
            const prev = messages[i - 1];
            const showHeader =
              i === 0 ||
              prev.username !== msg.username ||
              new Date(msg.createdAt).getTime() - new Date(prev.createdAt).getTime() > 60000;

            const isNew = newMsgIds.has(msg.id);
            const animClass = isNew ? (isMe ? "msg-new-right" : "msg-new-left") : "";

            return (
              <div key={msg.id} className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}>
                {showHeader && (
                  <div className={`flex items-baseline gap-1.5 mb-1 ${isMe ? "flex-row-reverse" : "flex-row"}`}>
                    <span className="text-xs font-semibold text-primary/80">{msg.username}</span>
                    <span className="text-[10px] text-muted-foreground">{format(new Date(msg.createdAt), "HH:mm")}</span>
                  </div>
                )}
                <div
                  className={`px-3 py-2 rounded-2xl break-words ${animClass} ${
                    isMe
                      ? "bg-primary text-primary-foreground rounded-tr-sm"
                      : "bg-secondary text-secondary-foreground rounded-tl-sm border border-border"
                  }`}
                  style={{
                    maxWidth: "min(75vw, 340px)",
                    willChange: isNew ? "transform, opacity" : "auto",
                  }}
                >
                  {msg.type === "image" && msg.imageUrl ? (
                    <img src={msg.imageUrl} alt="صورة" className="max-w-full rounded-lg object-cover" style={{ maxWidth: 260 }} loading="lazy" />
                  ) : (
                    <p className="leading-relaxed whitespace-pre-wrap text-sm">{msg.content}</p>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ── Input area ── */}
      <div className="bg-card/80 backdrop-blur-md border-t border-border shrink-0">

        {/* Typing indicator */}
        <div className="px-4 pt-2 h-5 flex items-center">
          {typingText && (
            <span className="text-xs text-muted-foreground italic flex items-center gap-1.5">
              <span className="flex gap-0.5">
                <span className="inline-block w-1 h-1 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="inline-block w-1 h-1 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="inline-block w-1 h-1 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </span>
              {typingText}
            </span>
          )}
        </div>

        <form onSubmit={handleSendMessage} className="flex items-center gap-2 px-3 py-2">
          {/* Emoji */}
          <Popover>
            <PopoverTrigger asChild>
              <Button type="button" variant="ghost" size="icon" className="shrink-0 h-9 w-9 rounded-full hover:bg-secondary text-muted-foreground">
                <Smile className="w-5 h-5" />
              </Button>
            </PopoverTrigger>
            <PopoverContent side="top" align="start" className="w-56 p-2 bg-popover/95 backdrop-blur-xl border-border">
              <div className="grid grid-cols-5 gap-1">
                {COMMON_EMOJIS.map((emoji) => (
                  <button key={emoji} type="button" className="p-1.5 text-lg hover:bg-secondary rounded-md transition-colors" onClick={() => setInputValue((prev) => prev + emoji)}>
                    {emoji}
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>

          {/* Image upload */}
          <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />
          <Button type="button" variant="ghost" size="icon" className="shrink-0 h-9 w-9 rounded-full hover:bg-secondary text-muted-foreground" onClick={() => fileInputRef.current?.click()}>
            <ImageIcon className="w-5 h-5" />
          </Button>

          {/* Text input */}
          <Input
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSendMessage(); }
            }}
            placeholder="اكتب رسالة..."
            className={`flex-1 h-9 rounded-full bg-secondary/50 border-secondary focus-visible:ring-primary px-4 text-sm transition-shadow ${inputFlash ? "input-sent-flash" : ""}`}
          />

          {/* Send button — rocket animation */}
          <Button
            ref={sendBtnRef}
            type="submit"
            size="icon"
            className={`shrink-0 h-9 w-9 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground transition-colors ${sendAnimating ? "btn-rocket-animate" : ""}`}
            style={{ willChange: sendAnimating ? "transform" : "auto" }}
            disabled={!inputValue.trim() || sendMessageMutation.isPending}
          >
            <Send className="w-4 h-4" />
          </Button>
        </form>

        {/* Footer */}
        <p className="text-center text-[10px] text-muted-foreground/50 pb-2 px-2">
          Made by Abdelwahab&nbsp;•&nbsp;Copyrights Reserved
        </p>
      </div>
    </div>
  );
}
