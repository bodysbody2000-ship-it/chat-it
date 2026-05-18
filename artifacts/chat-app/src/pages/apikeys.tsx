import { useEffect, useState } from "react";
import { useLocation, Link } from "wouter";
import { 
  useListApiKeys, 
  getListApiKeysQueryKey, 
  useCreateApiKey, 
  useDeleteApiKey 
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Copy, Trash2, Key, Terminal, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";

export default function ApiKeys() {
  const [, setLocation] = useLocation();
  const [newKeyName, setNewKeyName] = useState("");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  
  const queryClient = useQueryClient();
  
  const { data: apiKeys = [], isLoading } = useListApiKeys(undefined, {
    query: { queryKey: getListApiKeysQueryKey() }
  });
  
  const createMutation = useCreateApiKey();
  const deleteMutation = useDeleteApiKey();

  useEffect(() => {
    const token = localStorage.getItem("chat_token");
    if (!token) {
      setLocation("/");
    }
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
        }
      }
    );
  };

  const handleDelete = (id: number) => {
    if (confirm("Are you sure you want to revoke this key? Applications using it will lose access immediately.")) {
      deleteMutation.mutate(
        { id },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListApiKeysQueryKey() });
          }
        }
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
    <div className="min-h-[100dvh] bg-background text-foreground flex flex-col">
      <header className="flex items-center px-6 py-4 border-b border-border bg-card/50">
        <Link href="/chat" className="flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors mr-4">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex items-center gap-3">
          <Key className="w-5 h-5 text-primary" />
          <h1 className="text-xl font-bold tracking-tight">API ACCESS</h1>
        </div>
      </header>

      <main className="flex-1 p-6 max-w-5xl mx-auto w-full space-y-8">
        
        {/* Create Key Section */}
        <section className="bg-card border border-border rounded-xl p-6 shadow-sm">
          <h2 className="text-lg font-semibold mb-4 text-primary">Generate New Key</h2>
          <form onSubmit={handleCreate} className="flex gap-4 items-end max-w-md">
            <div className="flex-1 space-y-2">
              <label className="text-sm text-muted-foreground">Application Name</label>
              <Input 
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                placeholder="e.g. Android App Prod"
                className="bg-secondary/50 border-secondary focus-visible:ring-primary"
              />
            </div>
            <Button 
              type="submit" 
              disabled={!newKeyName.trim() || createMutation.isPending}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              Generate
            </Button>
          </form>
        </section>

        {/* Keys List */}
        <section className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
          <div className="p-6 border-b border-border">
            <h2 className="text-lg font-semibold text-primary">Active Keys</h2>
          </div>
          
          <Table>
            <TableHeader className="bg-secondary/20">
              <TableRow>
                <TableHead className="w-[200px]">Name</TableHead>
                <TableHead>Key</TableHead>
                <TableHead className="w-[150px]">Created</TableHead>
                <TableHead className="w-[100px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Loading keys...</TableCell>
                </TableRow>
              ) : apiKeys.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">No active API keys found.</TableCell>
                </TableRow>
              ) : (
                apiKeys.map((key) => (
                  <TableRow key={key.id} className="group hover:bg-secondary/10">
                    <TableCell className="font-medium">{key.name}</TableCell>
                    <TableCell className="font-mono text-sm text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <span>{key.key.substring(0, 8)}...{key.key.substring(key.key.length - 4)}</span>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => handleCopy(key.key)}
                        >
                          {copiedKey === key.key ? <CheckCircle2 className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(key.createdAt), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        onClick={() => handleDelete(key.id)}
                        disabled={deleteMutation.isPending}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </section>

        {/* Integration Instructions */}
        <section className="bg-card border border-border rounded-xl p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Terminal className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold text-primary">Android Studio Integration</h2>
          </div>
          
          <div className="space-y-4 text-sm">
            <div>
              <p className="text-muted-foreground mb-2">Base URL for Retrofit:</p>
              <code className="px-3 py-1.5 rounded-md bg-black/50 border border-border text-primary font-mono block">
                {baseUrl}
              </code>
            </div>
            
            <div>
              <p className="text-muted-foreground mb-2">Retrofit Setup Example:</p>
              <pre className="p-4 rounded-md bg-black/50 border border-border overflow-x-auto text-muted-foreground font-mono leading-relaxed">
{`interface ChatApi {
    @GET("/messages")
    suspend fun getMessages(
        @Header("Authorization") token: String = "Bearer YOUR_API_KEY"
    ): List<Message>

    @POST("/messages")
    suspend fun sendMessage(
        @Header("Authorization") token: String = "Bearer YOUR_API_KEY",
        @Body request: SendMessageRequest
    ): Message
}

val retrofit = Retrofit.Builder()
    .baseUrl("${baseUrl}")
    .addConverterFactory(GsonConverterFactory.create())
    .build()`}
              </pre>
            </div>
          </div>
        </section>

      </main>
    </div>
  );
}
