import { useEffect, useState, useRef } from "react";
import { useLocation, Link } from "wouter";
import { 
  useGetMessages, 
  getGetMessagesQueryKey, 
  useSendMessage, 
  useUploadImage,
} from "@workspace/api-client-react";
import type { Message } from "@workspace/api-client-react/src/generated/api.schemas";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Send, Image as ImageIcon, Smile, KeyRound, LogOut, Loader2, Wifi, WifiOff } from "lucide-react";
import { format } from "date-fns";

const COMMON_EMOJIS = [
  "😀", "😂", "🤣", "😊", "😍", "🥰", "😎", "🤩", "😘", "😗",
  "😋", "😛", "😜", "🤪", "😝", "🤑", "🤗", "🤭", "🤫", "🤔",
  "🤐", "🤨", "😐", "😑", "😶", "😏", "😒", "🙄", "😬", "🤥",
  "😌", "😔", "😪", "🤤", "😴", "😷", "🤒", "🤕", "🤢", "🤮",
  "🤧", "🥵", "🥶", "🥴", "😵", "🤯", "🤠", "🥳", "😎", "🤓"
];

export default function Chat() {
  const [, setLocation] = useLocation();
  const [username, setUsername] = useState("");
  const [showUsernamePrompt, setShowUsernamePrompt] = useState(false);
  const [tempUsername, setTempUsername] = useState("");
  const [wsConnected, setWsConnected] = useState(false);
  
  const [inputValue, setInputValue] = useState("");
  const [liveMessages, setLiveMessages] = useState<Message[]>([]);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const queryClient = useQueryClient();
  const { data: initialMessages = [], isLoading } = useGetMessages(undefined, { 
    query: { queryKey: getGetMessagesQueryKey() } 
  });
  
  const sendMessageMutation = useSendMessage();
  const uploadImageMutation = useUploadImage();

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

  useEffect(() => {
    if (!username) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/api/ws`;
    
    let ws: WebSocket;
    let reconnectTimeout: ReturnType<typeof setTimeout>;

    const connect = () => {
      ws = new WebSocket(wsUrl);
      
      ws.onopen = () => setWsConnected(true);
      
      ws.onclose = () => {
        setWsConnected(false);
        reconnectTimeout = setTimeout(connect, 3000);
      };
      
      ws.onmessage = (event) => {
        try {
          const msg: Message = JSON.parse(event.data);
          setLiveMessages(prev => {
            if (prev.some(m => m.id === msg.id)) return prev;
            return [...prev, msg];
          });
          // Also update cache so if we navigate away and back, it's there
          queryClient.setQueryData<Message[]>(getGetMessagesQueryKey(), (old) => {
            if (!old) return [msg];
            if (old.some(m => m.id === msg.id)) return old;
            return [...old, msg];
          });
        } catch (e) {
          console.error("Failed to parse websocket message", e);
        }
      };
    };

    connect();

    return () => {
      if (ws) ws.close();
      clearTimeout(reconnectTimeout);
    };
  }, [username, queryClient]);

  const allMessages = [...initialMessages];
  liveMessages.forEach(lm => {
    if (!allMessages.some(m => m.id === lm.id)) {
      allMessages.push(lm);
    }
  });
  
  // Sort just in case
  allMessages.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [allMessages.length]);

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

    sendMessageMutation.mutate({
      data: {
        content: inputValue.trim(),
        type: "text",
        username
      }
    }, {
      onSuccess: () => {
        setInputValue("");
      }
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      // Create a temporary file object that API client might be able to handle
      // Usually orval generates a blob or file for the filename parameter or body
      // We will cast it to any and see if it works with FormData in custom-fetch
      uploadImageMutation.mutate(
        { data: { filename: file.name } as any }, // Assuming the generated api.ts takes FormData in fetch
        {
          onSuccess: (data) => {
             // Let's assume the API might need us to do a separate fetch for the file if orval generated it weirdly
             // Or the data returns the URL
             sendMessageMutation.mutate({
               data: {
                 content: "Sent an image",
                 type: "image",
                 username,
                 imageUrl: data.url
               }
             });
          }
        }
      );
      
      // Fallback manual upload if orval hook doesn't support File correctly
      const token = localStorage.getItem("chat_token");
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` },
        body: formData
      });
      if (res.ok) {
        const data = await res.json();
        sendMessageMutation.mutate({
          data: {
            content: "Sent an image",
            type: "image",
            username,
            imageUrl: data.url
          }
        });
      }
      
    } catch (err) {
      console.error("Upload failed", err);
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
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
        <DialogContent className="sm:max-w-md [&>button]:hidden">
          <DialogHeader>
            <DialogTitle>Enter your codename</DialogTitle>
            <DialogDescription>
              Identify yourself on the secure channel.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center space-x-2 mt-4">
            <Input 
              value={tempUsername}
              onChange={(e) => setTempUsername(e.target.value)}
              placeholder="e.g. Neo"
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveUsername();
              }}
            />
            <Button onClick={handleSaveUsername} disabled={!tempUsername.trim()}>Confirm</Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <div className="flex flex-col h-[100dvh] bg-background text-foreground">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-border/50 bg-card/50 backdrop-blur-sm z-10 shrink-0">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold tracking-tight text-primary">SECURE COMM</h1>
          <div className="flex items-center gap-2 text-xs font-mono">
            <span className="relative flex h-3 w-3">
              {wsConnected && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
              )}
              <span className={`relative inline-flex rounded-full h-3 w-3 ${wsConnected ? 'bg-primary' : 'bg-muted-foreground'}`}></span>
            </span>
            <span className={wsConnected ? 'text-primary' : 'text-muted-foreground'}>
              {wsConnected ? 'LINK ESTABLISHED' : 'LINK SEVERED'}
            </span>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <Link href="/apikeys" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors">
            <KeyRound className="w-4 h-4" />
            <span className="hidden sm:inline">API Keys</span>
          </Link>
          <div className="h-4 w-px bg-border"></div>
          <span className="text-sm font-mono text-primary/70">{username}</span>
          <Button variant="ghost" size="icon" onClick={handleLogout} className="text-muted-foreground hover:text-destructive hover:bg-destructive/10">
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </header>

      {/* Messages */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6"
      >
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
          </div>
        ) : allMessages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground font-mono text-sm uppercase">
            No transmissions found.
          </div>
        ) : (
          allMessages.map((msg, i) => {
            const isMe = msg.username === username;
            const showHeader = i === 0 || allMessages[i - 1].username !== msg.username || new Date(msg.createdAt).getTime() - new Date(allMessages[i - 1].createdAt).getTime() > 60000;
            
            return (
              <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} max-w-3xl ${isMe ? 'ml-auto' : 'mr-auto'}`}>
                {showHeader && (
                  <div className={`flex items-baseline gap-2 mb-1 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                    <span className="text-xs font-bold text-primary/80">{msg.username}</span>
                    <span className="text-[10px] text-muted-foreground">{format(new Date(msg.createdAt), "HH:mm")}</span>
                  </div>
                )}
                
                <div className={`
                  group relative px-4 py-2 rounded-2xl max-w-[85vw] sm:max-w-md break-words
                  ${isMe 
                    ? 'bg-primary text-primary-foreground rounded-tr-sm shadow-[0_0_15px_rgba(var(--primary),0.2)]' 
                    : 'bg-secondary text-secondary-foreground rounded-tl-sm border border-secondary-border'
                  }
                `}>
                  {msg.type === "image" && msg.imageUrl ? (
                    <img 
                      src={msg.imageUrl} 
                      alt="transmission" 
                      className="max-w-full sm:max-w-[300px] rounded-lg mt-1 mb-1 object-cover" 
                      loading="lazy"
                    />
                  ) : (
                    <p className="leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Input */}
      <div className="p-4 bg-card/80 backdrop-blur-md border-t border-border shrink-0">
        <form onSubmit={handleSendMessage} className="max-w-5xl mx-auto flex items-end gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button type="button" variant="ghost" size="icon" className="shrink-0 h-12 w-12 rounded-full hover:bg-secondary text-muted-foreground hover:text-foreground">
                <Smile className="w-6 h-6" />
              </Button>
            </PopoverTrigger>
            <PopoverContent side="top" align="start" className="w-64 p-2 bg-popover/95 backdrop-blur-xl border-border">
              <div className="grid grid-cols-5 gap-1">
                {COMMON_EMOJIS.map(emoji => (
                  <button
                    key={emoji}
                    type="button"
                    className="p-2 text-xl hover:bg-secondary rounded-md transition-colors"
                    onClick={() => setInputValue(prev => prev + emoji)}
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
            className="shrink-0 h-12 w-12 rounded-full hover:bg-secondary text-muted-foreground hover:text-foreground"
            onClick={() => fileInputRef.current?.click()}
          >
            <ImageIcon className="w-6 h-6" />
          </Button>

          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Transmit message..."
            className="flex-1 h-12 rounded-full bg-secondary/50 border-secondary focus-visible:ring-primary px-6 text-base"
          />

          <Button 
            type="submit" 
            size="icon" 
            className="shrink-0 h-12 w-12 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-[0_0_15px_rgba(var(--primary),0.3)] transition-all hover:scale-105 active:scale-95"
            disabled={!inputValue.trim() || sendMessageMutation.isPending}
          >
            {sendMessageMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5 ml-1" />}
          </Button>
        </form>
      </div>
    </div>
  );
}
