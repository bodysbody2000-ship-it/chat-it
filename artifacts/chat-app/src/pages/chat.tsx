import { useEffect, useState, useRef, useCallback } from "react";
import { useLocation, Link } from "wouter";
import { useSendMessage } from "@workspace/api-client-react";
import type { Message } from "@workspace/api-client-react/src/generated/api.schemas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Send, Image as ImageIcon, Smile, KeyRound, LogOut, Loader2 } from "lucide-react";
import { format } from "date-fns";

const COMMON_EMOJIS = [
  "😀", "😂", "🤣", "😊", "😍", "🥰", "😎", "🤩", "😘", "😗",
  "😋", "😛", "😜", "🤪", "😝", "🤑", "🤗", "🤭", "🤫", "🤔",
  "🤐", "🤨", "😐", "😑", "😶", "😏", "😒", "🙄", "😬", "🤥",
  "😌", "😔", "😪", "🤤", "😴", "😷", "🤒", "🤕", "🤢", "🤮",
  "🤧", "🥵", "🥶", "🥴", "😵", "🤯", "🤠", "🥳", "❤️", "👍"
];

/*
 * ===== كيف يعمل الـ Polling (التحديث التلقائي) =====
 *
 * بدل WebSocket (مش بيشتغل على Vercel)، بنستخدم Polling:
 *
 * كل 3 ثواني:
 *   المتصفح بيبعت GET /api/messages لجلب أحدث الرسائل
 *   لو في رسائل جديدة، بيحدث الـ State تلقائياً
 *   المستخدم ما يحسش بأي ريفريش كامل للصفحة
 *
 * useEffect + setInterval = منبه بيشتغل في الخلفية
 * clearInterval = بنوقف المنبه لما المستخدم يخرج من الصفحة
 */

export default function Chat() {
  const [, setLocation] = useLocation();
  const [username, setUsername] = useState("");
  const [showUsernamePrompt, setShowUsernamePrompt] = useState(false);
  const [tempUsername, setTempUsername] = useState("");
  const [isConnected, setIsConnected] = useState(true);

  const [inputValue, setInputValue] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const sendMessageMutation = useSendMessage();

  // ===== جلب الرسائل من السيرفر =====
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
      setMessages(data);
      setIsConnected(true);
    } catch {
      setIsConnected(false);
    } finally {
      setIsLoading(false);
    }
  }, [setLocation]);

  // ===== التحقق من الدخول =====
  useEffect(() => {
    const token = localStorage.getItem("chat_token");
    if (!token) {
      setLocation("/");
      return;
    }
    const storedUsername = localStorage.getItem("chat_username");
    if (!storedUsername) {
      setShowUsernamePrompt(true);
    } else {
      setUsername(storedUsername);
    }
  }, [setLocation]);

  // ===== Polling: جلب الرسائل كل 3 ثواني =====
  useEffect(() => {
    if (!username) return;

    // جلب فوري أول ما ندخل
    fetchMessages();

    // منبه بيشتغل كل 3000 ميللي ثانية (3 ثواني)
    const interval = setInterval(() => {
      fetchMessages();
    }, 3000);

    // تنظيف: بنوقف المنبه لما المستخدم يخرج من الصفحة
    return () => clearInterval(interval);
  }, [username, fetchMessages]);

  // ===== auto-scroll لآخر رسالة =====
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length]);

  const handleSaveUsername = () => {
    if (tempUsername.trim().length > 0) {
      localStorage.setItem("chat_username", tempUsername.trim());
      setUsername(tempUsername.trim());
      setShowUsernamePrompt(false);
    }
  };

  const handleSendMessage = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputValue.trim() || sendMessageMutation.isPending) return;

    sendMessageMutation.mutate(
      { data: { content: inputValue.trim(), type: "text", username } },
      {
        onSuccess: (newMsg) => {
          setInputValue("");
          setMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
          setTimeout(() => {
            if (scrollRef.current) {
              scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
            }
          }, 50);
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
        sendMessageMutation.mutate({
          data: { content: "صورة", type: "image", username, imageUrl: data.url },
        });
      }
    } catch {
      /* silent */
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
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
            <Button onClick={handleSaveUsername} disabled={!tempUsername.trim()}>
              تأكيد
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <div
      style={{ height: "100dvh" }}
      className="flex flex-col bg-background text-foreground overflow-hidden"
    >
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-border/50 bg-card/50 backdrop-blur-sm shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <h1 className="text-lg font-bold text-primary truncate">Chat</h1>
          <div className="flex items-center gap-1.5 text-xs shrink-0">
            <span className="relative flex h-2 w-2">
              {isConnected && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
              )}
              <span
                className={`relative inline-flex rounded-full h-2 w-2 ${
                  isConnected ? "bg-primary" : "bg-muted-foreground"
                }`}
              />
            </span>
            <span className={isConnected ? "text-primary" : "text-muted-foreground"}>
              {isConnected ? "متصل" : "غير متصل"}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Link
            href="/apikeys"
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors"
          >
            <KeyRound className="w-4 h-4" />
            <span className="hidden sm:inline text-xs">API Keys</span>
          </Link>
          <div className="h-4 w-px bg-border" />
          <span className="text-xs font-medium text-primary/70 max-w-[80px] truncate">
            {username}
          </span>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleLogout}
            className="h-8 w-8 text-muted-foreground hover:text-destructive"
          >
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </header>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-4 space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-7 h-7 text-primary animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
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

            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}
              >
                {showHeader && (
                  <div
                    className={`flex items-baseline gap-2 mb-1 ${
                      isMe ? "flex-row-reverse" : "flex-row"
                    }`}
                  >
                    <span className="text-xs font-semibold text-primary/80">
                      {msg.username}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {format(new Date(msg.createdAt), "HH:mm")}
                    </span>
                  </div>
                )}

                <div
                  className={`px-3 py-2 rounded-2xl break-words ${
                    isMe
                      ? "bg-primary text-primary-foreground rounded-tr-sm max-w-[75vw] sm:max-w-sm"
                      : "bg-secondary text-secondary-foreground rounded-tl-sm border border-secondary-border max-w-[75vw] sm:max-w-sm"
                  }`}
                >
                  {msg.type === "image" && msg.imageUrl ? (
                    <img
                      src={msg.imageUrl}
                      alt="صورة"
                      className="max-w-full rounded-lg object-cover"
                      style={{ maxWidth: 260 }}
                      loading="lazy"
                    />
                  ) : (
                    <p className="leading-relaxed whitespace-pre-wrap text-sm sm:text-base">
                      {msg.content}
                    </p>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Input bar */}
      <div className="px-3 py-3 bg-card/80 backdrop-blur-md border-t border-border shrink-0">
        <form
          onSubmit={handleSendMessage}
          className="flex items-center gap-2"
        >
          <Popover>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="shrink-0 h-10 w-10 rounded-full hover:bg-secondary text-muted-foreground"
              >
                <Smile className="w-5 h-5" />
              </Button>
            </PopoverTrigger>
            <PopoverContent
              side="top"
              align="start"
              className="w-56 p-2 bg-popover/95 backdrop-blur-xl border-border"
            >
              <div className="grid grid-cols-5 gap-1">
                {COMMON_EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    className="p-1.5 text-lg hover:bg-secondary rounded-md transition-colors"
                    onClick={() => setInputValue((prev) => prev + emoji)}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>

          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            accept="image/*"
            onChange={handleFileChange}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="shrink-0 h-10 w-10 rounded-full hover:bg-secondary text-muted-foreground"
            onClick={() => fileInputRef.current?.click()}
          >
            <ImageIcon className="w-5 h-5" />
          </Button>

          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            placeholder="اكتب رسالة..."
            className="flex-1 h-10 rounded-full bg-secondary/50 border-secondary focus-visible:ring-primary px-4 text-sm"
          />

          <Button
            type="submit"
            size="icon"
            className="shrink-0 h-10 w-10 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground transition-all active:scale-95"
            disabled={!inputValue.trim() || sendMessageMutation.isPending}
          >
            {sendMessageMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
