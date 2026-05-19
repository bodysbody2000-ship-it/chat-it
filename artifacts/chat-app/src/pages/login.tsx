import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLogin } from "@workspace/api-client-react";
import { Lock } from "lucide-react";

export default function Login() {
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [, setLocation] = useLocation();
  const loginMutation = useLogin();

  useEffect(() => {
    if (localStorage.getItem("chat_token")) {
      setLocation("/chat");
    }
  }, [setLocation]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !password) return;
    loginMutation.mutate(
      { data: { password } },
      {
        onSuccess: (data) => {
          localStorage.setItem("chat_token", data.token);
          localStorage.setItem("chat_username", name.trim());
          setLocation("/chat");
        },
      }
    );
  };

  return (
    <div
      style={{ minHeight: "100dvh" }}
      className="bg-background flex flex-col items-center justify-center p-4"
    >
      <div className="w-full max-w-xs">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mb-4">
            <Lock className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Chat</h1>
          <p className="text-muted-foreground text-sm mt-1">ادخل كلمة السر للدخول</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <Input
            type="text"
            placeholder="اسمك"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="nickname"
            className="h-12 bg-secondary/50 border-secondary/50 focus:border-primary text-center text-lg"
            dir="rtl"
          />
          <Input
            type="password"
            placeholder="كلمة السر"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            className="h-12 bg-secondary/50 border-secondary/50 focus:border-primary text-center text-lg"
          />
          <Button
            type="submit"
            className="w-full h-12 text-lg font-medium"
            disabled={loginMutation.isPending || !password || !name.trim()}
          >
            {loginMutation.isPending ? "جاري الدخول..." : "دخول"}
          </Button>
          {loginMutation.isError && (
            <p className="text-destructive text-sm text-center">كلمة السر غلط — الكلمة الصح: 4444</p>
          )}
        </form>
      </div>
    </div>
  );
}
