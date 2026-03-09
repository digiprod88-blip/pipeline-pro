import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { MessageCircle, RefreshCw, Smartphone, CheckCircle2, XCircle, Loader2 } from "lucide-react";

interface WhatsAppSession {
  id: string;
  session_status: string;
  phone_number: string | null;
  last_sync_at: string | null;
}

export function WhatsAppQRConnection() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [polling, setPolling] = useState(false);

  const { data: session, isLoading } = useQuery({
    queryKey: ["whatsapp-session"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_sessions")
        .select("*")
        .eq("user_id", user!.id)
        .single();
      if (error && error.code !== "PGRST116") throw error;
      return data as WhatsAppSession | null;
    },
    enabled: !!user,
  });

  const generateQRMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("whatsapp-qr", {
        body: { action: "generate" },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      setQrCode(data.qr_code);
      setPolling(true);
      toast.success("Scan the QR code with WhatsApp");
    },
    onError: (e: any) => {
      toast.error(e.message || "Failed to generate QR code");
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("whatsapp_sessions")
        .update({ session_status: "disconnected", phone_number: null })
        .eq("user_id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-session"] });
      setQrCode(null);
      setPolling(false);
      toast.success("WhatsApp disconnected");
    },
  });

  // Poll for connection status with retry logic
  useEffect(() => {
    if (!polling) return;

    let retryCount = 0;
    const MAX_RETRIES = 40; // 40 * 3s = 120s
    let isCancelled = false;

    const poll = async () => {
      if (isCancelled || retryCount >= MAX_RETRIES) {
        if (!isCancelled && retryCount >= MAX_RETRIES) {
          setPolling(false);
          setQrCode(null);
          toast.error("QR code expired. Please try again.");
        }
        return;
      }

      retryCount++;

      try {
        const { data } = await supabase
          .from("whatsapp_sessions")
          .select("session_status, phone_number")
          .eq("user_id", user!.id)
          .maybeSingle();

        if (data?.session_status === "connected") {
          setPolling(false);
          setQrCode(null);
          queryClient.invalidateQueries({ queryKey: ["whatsapp-session"] });
          toast.success("WhatsApp connected successfully!");
          return;
        }
      } catch (err) {
        console.warn("WhatsApp poll error:", err);
      }

      if (!isCancelled) {
        setTimeout(poll, 3000);
      }
    };

    poll();

    return () => {
      isCancelled = true;
    };
  }, [polling, user, queryClient]);

  const isConnected = session?.session_status === "connected";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <MessageCircle className="h-4 w-4" />
          WhatsApp Connection
        </CardTitle>
        <CardDescription>
          Connect your WhatsApp account to send and receive messages directly from the CRM
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : isConnected ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-4 rounded-lg bg-success/10 border border-success/20">
              <CheckCircle2 className="h-5 w-5 text-success" />
              <div className="flex-1">
                <p className="text-sm font-medium text-success">Connected</p>
                {session?.phone_number && (
                  <p className="text-xs text-muted-foreground">{session.phone_number}</p>
                )}
              </div>
              <Badge variant="success" className="text-xs">Active</Badge>
            </div>
            
            {session?.last_sync_at && (
              <p className="text-xs text-muted-foreground">
                Last synced: {new Date(session.last_sync_at).toLocaleString()}
              </p>
            )}

            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => generateQRMutation.mutate()}>
                <RefreshCw className="h-4 w-4 mr-1" />
                Reconnect
              </Button>
              <Button variant="destructive" size="sm" onClick={() => disconnectMutation.mutate()}>
                <XCircle className="h-4 w-4 mr-1" />
                Disconnect
              </Button>
            </div>
          </div>
        ) : qrCode ? (
          <div className="space-y-4 text-center">
            <div className="inline-block p-4 bg-white rounded-xl">
              {/* QR Code placeholder - in production this would be an actual QR code image */}
              <div className="w-48 h-48 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyMDAgMjAwIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2ZmZiIvPjxyZWN0IHg9IjIwIiB5PSIyMCIgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIi8+PHJlY3QgeD0iMTQwIiB5PSIyMCIgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIi8+PHJlY3QgeD0iMjAiIHk9IjE0MCIgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIi8+PHJlY3QgeD0iODAiIHk9IjgwIiB3aWR0aD0iNDAiIGhlaWdodD0iNDAiLz48cmVjdCB4PSI4MCIgeT0iMjAiIHdpZHRoPSIyMCIgaGVpZ2h0PSIyMCIvPjxyZWN0IHg9IjEwMCIgeT0iNDAiIHdpZHRoPSIyMCIgaGVpZ2h0PSIyMCIvPjxyZWN0IHg9IjgwIiB5PSI2MCIgd2lkdGg9IjIwIiBoZWlnaHQ9IjIwIi8+PHJlY3QgeD0iMjAiIHk9IjgwIiB3aWR0aD0iMjAiIGhlaWdodD0iMjAiLz48cmVjdCB4PSI0MCIgeT0iMTAwIiB3aWR0aD0iMjAiIGhlaWdodD0iMjAiLz48cmVjdCB4PSIxNDAiIHk9IjgwIiB3aWR0aD0iMjAiIGhlaWdodD0iMjAiLz48cmVjdCB4PSIxNjAiIHk9IjEwMCIgd2lkdGg9IjIwIiBoZWlnaHQ9IjIwIi8+PHJlY3QgeD0iMTQwIiB5PSIxNDAiIHdpZHRoPSIyMCIgaGVpZ2h0PSIyMCIvPjxyZWN0IHg9IjgwIiB5PSIxNjAiIHdpZHRoPSI0MCIgaGVpZ2h0PSIyMCIvPjwvc3ZnPg==')] bg-contain" />
            </div>
            
            <div className="space-y-2">
              <p className="text-sm font-medium">Scan with WhatsApp</p>
              <ol className="text-xs text-muted-foreground text-left space-y-1 max-w-xs mx-auto">
                <li>1. Open WhatsApp on your phone</li>
                <li>2. Go to Settings → Linked Devices</li>
                <li>3. Tap "Link a Device"</li>
                <li>4. Point your phone at this QR code</li>
              </ol>
            </div>

            {polling && (
              <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                Waiting for connection...
              </div>
            )}

            <Button variant="ghost" size="sm" onClick={() => { setQrCode(null); setPolling(false); }}>
              Cancel
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/50 border border-border">
              <XCircle className="h-5 w-5 text-muted-foreground" />
              <div className="flex-1">
                <p className="text-sm font-medium">Not Connected</p>
                <p className="text-xs text-muted-foreground">Connect your WhatsApp to start messaging</p>
              </div>
            </div>

            <Button onClick={() => generateQRMutation.mutate()} disabled={generateQRMutation.isPending}>
              {generateQRMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Smartphone className="h-4 w-4 mr-2" />
              )}
              Connect WhatsApp
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
