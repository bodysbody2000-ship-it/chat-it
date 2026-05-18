import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLogin } from "@workspace/api-client-react";
import { Lock } from "lucide-react";

export default function Login() {
  const [password, setPassword] = useState("");
  const [, setLocation] = useLocation();
  const loginMutation = useLogin();

  useEffect(() => {
    if (localStorage.getItem("chat_token")) {
      setLocation("/chat");
    }
  }, [setLocation]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loginMutation.mutate(
      { data: { password } },
      {
        onSuccess: (data) => {
          localStorage.setItem("chat_token", data.token);
          setLocation("/chat");
        },
      }
    );
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mb-4">
            <Lock className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Secure Comm</h1>
          <p className="text-muted-foreground text-sm mt-1">Enter passphrase to access</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            type="password"
            placeholder="Passphrase (4444)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-12 bg-secondary/50 border-secondary/50 focus:border-primary text-center text-lg"
          />
          <Button 
            type="submit" 
            className="w-full h-12 text-lg font-medium"
            disabled={loginMutation.isPending || !password}
          >
            {loginMutation.isPending ? "Decrypting..." : "Access"}
          </Button>
          {loginMutation.isError && (
            <p className="text-destructive text-sm text-center">Access denied</p>
          )}
        </form>
      </div>
    </div>
  );
}
