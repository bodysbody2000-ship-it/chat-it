import { useEffect, useState } from "react";
import { useLocation, Link } from "wouter";
import {
  useListApiKeys,
  getListApiKeysQueryKey,
  useCreateApiKey,
  useDeleteApiKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Copy, Trash2, Key, Terminal, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";

export default function ApiKeys() {
  const [, setLocation] = useLocation();
  const [newKeyName, setNewKeyName] = useState("");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const queryClient = useQueryClient();

  const { data: apiKeys = [], isLoading } = useListApiKeys({
    query: { queryKey: getListApiKeysQueryKey() },
  });

  const createMutation = useCreateApiKey();
  const deleteMutation = useDeleteApiKey();

  useEffect(() => {
    const token = localStorage.getItem("chat_token");
    if (!token) setLocation("/");
  }, [setLocation]);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyName.trim()) return;
    createMutation.mutate(
      { data: { name: newKeyName.trim() } },
      {
        onSuccess: () => {
          setNewKeyName("");
          queryClient.invalidateQueries({ queryKey: getListApiKeysQueryKey() });
        },
      }
    );
  };

  const handleDelete = (id: number) => {
    if (confirm("هتحذف المفتاح ده؟ أي تطبيق بيستخدمه هيوقف فوراً.")) {
      deleteMutation.mutate(
        { id },
        { onSuccess: () => queryClient.invalidateQueries({ queryKey: getListApiKeysQueryKey() }) }
      );
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(text);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const baseUrl = `https://${window.location.host}/api`;

  return (
    <div
      style={{ minHeight: "100dvh" }}
      className="bg-background text-foreground flex flex-col overflow-x-hidden"
    >
      <header className="flex items-center px-4 py-3 border-b border-border bg-card/50 shrink-0">
        <Link
          href="/chat"
          className="flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors mr-3"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="text-sm">رجوع</span>
        </Link>
        <div className="flex items-center gap-2">
          <Key className="w-4 h-4 text-primary" />
          <h1 className="text-lg font-bold">مفاتيح API</h1>
        </div>
      </header>

      <main className="flex-1 p-4 max-w-2xl mx-auto w-full space-y-6">
        {/* Create Key */}
        <section className="bg-card border border-border rounded-xl p-4 shadow-sm">
          <h2 className="text-base font-semibold mb-3 text-primary">إنشاء مفتاح جديد</h2>
          <form onSubmit={handleCreate} className="flex gap-2 items-end">
            <div className="flex-1 space-y-1">
              <label className="text-xs text-muted-foreground">اسم التطبيق</label>
              <Input
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                placeholder="مثال: Android App"
                className="bg-secondary/50 border-secondary focus-visible:ring-primary"
              />
            </div>
            <Button
              type="submit"
              disabled={!newKeyName.trim() || createMutation.isPending}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              إنشاء
            </Button>
          </form>
        </section>

        {/* Keys List */}
        <section className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-border">
            <h2 className="text-base font-semibold text-primary">المفاتيح النشطة</h2>
          </div>
          <div className="divide-y divide-border">
            {isLoading ? (
              <p className="text-center py-6 text-muted-foreground text-sm">جاري التحميل...</p>
            ) : apiKeys.length === 0 ? (
              <p className="text-center py-6 text-muted-foreground text-sm">مفيش مفاتيح لحد دلوقتي.</p>
            ) : (
              apiKeys.map((key) => (
                <div
                  key={key.id}
                  className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-secondary/10"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{key.name}</p>
                    <p className="text-xs text-muted-foreground font-mono truncate">
                      {key.key.substring(0, 10)}...{key.key.substring(key.key.length - 4)}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {format(new Date(key.createdAt), "d MMM yyyy")}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-primary"
                      onClick={() => handleCopy(key.key)}
                    >
                      {copiedKey === key.key ? (
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => handleDelete(key.id)}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Integration Instructions */}
        <section className="bg-card border border-border rounded-xl p-4 shadow-sm space-y-4">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-primary" />
            <h2 className="text-base font-semibold text-primary">كود Android Studio</h2>
          </div>

          <div>
            <p className="text-xs text-muted-foreground mb-1">Base URL للـ Retrofit:</p>
            <code className="px-3 py-2 rounded-md bg-black/50 border border-border text-primary font-mono text-xs block break-all">
              {baseUrl}
            </code>
          </div>

          <div>
            <p className="text-xs text-muted-foreground mb-2">
              استخدم المفتاح في الـ Header بدل كلمة السر:
            </p>
            <pre className="p-3 rounded-md bg-black/50 border border-border text-muted-foreground font-mono text-xs leading-relaxed overflow-x-auto">
{`interface ChatApi {

    // جلب الرسائل
    @GET("messages")
    suspend fun getMessages(
        @Header("X-API-Key") apiKey: String
    ): List<Message>

    // إرسال رسالة
    @POST("messages")
    suspend fun sendMessage(
        @Header("X-API-Key") apiKey: String,
        @Body request: SendMessageRequest
    ): Message
}

// إعداد Retrofit
val retrofit = Retrofit.Builder()
    .baseUrl("${baseUrl}/")
    .addConverterFactory(GsonConverterFactory.create())
    .build()

// الاستخدام
val api = retrofit.create(ChatApi::class.java)
api.getMessages(apiKey = "YOUR_KEY_HERE")`}
            </pre>
          </div>

          <div className="bg-primary/10 border border-primary/20 rounded-lg p-3">
            <p className="text-xs text-primary font-medium mb-1">ملاحظة مهمة للـ Vercel:</p>
            <p className="text-xs text-muted-foreground">
              الرسائل بتتحدث كل 3 ثواني تلقائياً (Polling). مش محتاج WebSocket.
              في Android Studio اعمل Timer بيجيب الرسائل كل 3 ثواني بنفس الفكرة.
            </p>
          </div>
        </section>

        {/* Polling Explanation */}
        <section className="bg-card border border-border rounded-xl p-4 shadow-sm space-y-3">
          <h2 className="text-base font-semibold text-primary">شرح فكرة Polling</h2>
          <p className="text-xs text-muted-foreground leading-relaxed">
            بدل ما نفتح اتصال دائم (WebSocket)، المتصفح بيسأل السيرفر كل 3 ثواني:
            "في رسائل جديدة؟" — لو أيوه، بيحدث الشاشة تلقائياً من غير ما المستخدم يعمل ريفريش.
          </p>
          <pre className="p-3 rounded-md bg-black/50 border border-border text-muted-foreground font-mono text-xs leading-relaxed overflow-x-auto">
{`// React / Next.js — Polling كل 3 ثواني
useEffect(() => {

  // جلب الرسائل فوراً
  fetchMessages();

  // منبه بيشتغل كل 3000ms (3 ثواني)
  const interval = setInterval(() => {
    fetchMessages(); // GET /api/messages
  }, 3000);

  // تنظيف: وقف المنبه لما الصفحة تُغلق
  return () => clearInterval(interval);

}, []); // بيشتغل مرة واحدة عند فتح الصفحة

async function fetchMessages() {
  const res = await fetch("/api/messages", {
    headers: { "X-API-Key": "YOUR_KEY" }
  });
  const data = await res.json();
  setMessages(data); // تحديث الـ State → الشاشة بتتحدث تلقائياً
}

async function sendMessage(content) {
  await fetch("/api/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": "YOUR_KEY"
    },
    body: JSON.stringify({ content, type: "text", username: "أنت" })
  });
}`}
          </pre>
        </section>
      </main>
    </div>
  );
}
