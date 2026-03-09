import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart2, Check, Code, Eye, Target } from "lucide-react";
import { toast } from "sonner";

export function MetaPixelSettings() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: pixels } = useQuery({
    queryKey: ["tracking-pixels"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tracking_pixels")
        .select("*")
        .eq("user_id", user!.id);
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const metaPixel = pixels?.find((p) => p.pixel_type === "meta");
  const [form, setForm] = useState({
    header_pixel_id: "",
    thankyou_pixel_id: "",
    is_active: true,
  });

  useEffect(() => {
    if (metaPixel) {
      setForm({
        header_pixel_id: metaPixel.header_pixel_id || "",
        thankyou_pixel_id: metaPixel.thankyou_pixel_id || "",
        is_active: metaPixel.is_active,
      });
    }
  }, [metaPixel]);

  const savePixel = useMutation({
    mutationFn: async () => {
      const payload = {
        user_id: user!.id,
        pixel_type: "meta",
        header_pixel_id: form.header_pixel_id || null,
        thankyou_pixel_id: form.thankyou_pixel_id || null,
        is_active: form.is_active,
      };

      if (metaPixel?.id) {
        const { error } = await supabase
          .from("tracking_pixels")
          .update(payload)
          .eq("id", metaPixel.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("tracking_pixels").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tracking-pixels"] });
      toast.success("Pixel settings saved!");
    },
    onError: (e) => toast.error(e.message),
  });

  const headerCode = form.header_pixel_id
    ? `<!-- Meta Pixel Code -->
<script>
!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window, document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '${form.header_pixel_id}');
fbq('track', 'PageView');
</script>
<noscript><img height="1" width="1" style="display:none"
src="https://www.facebook.com/tr?id=${form.header_pixel_id}&ev=PageView&noscript=1"/>
</noscript>
<!-- End Meta Pixel Code -->`
    : "";

  const thankyouCode = form.thankyou_pixel_id
    ? `<!-- Meta Conversion Event -->
<script>
fbq('track', 'Lead', {
  content_name: 'Form Submission',
  pixel_id: '${form.thankyou_pixel_id}'
});
</script>`
    : "";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="h-5 w-5" />
          Meta Pixel Tracking
          {form.is_active && form.header_pixel_id && (
            <Badge variant="success" className="ml-2 text-xs">
              <Check className="h-3 w-3 mr-1" /> Active
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          Configure Facebook/Meta Pixel for tracking conversions on your landing pages
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label>Enable Pixel Tracking</Label>
            <p className="text-xs text-muted-foreground">Track page views and conversions</p>
          </div>
          <Switch
            checked={form.is_active}
            onCheckedChange={(v) => setForm({ ...form, is_active: v })}
          />
        </div>

        <Tabs defaultValue="setup" className="space-y-4">
          <TabsList>
            <TabsTrigger value="setup">Setup</TabsTrigger>
            <TabsTrigger value="code">Generated Code</TabsTrigger>
          </TabsList>

          <TabsContent value="setup" className="space-y-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Eye className="h-4 w-4" />
                Header Pixel ID
              </Label>
              <Input
                value={form.header_pixel_id}
                onChange={(e) => setForm({ ...form, header_pixel_id: e.target.value })}
                placeholder="123456789012345"
              />
              <p className="text-xs text-muted-foreground">
                This pixel fires on every page load. Used for PageView tracking.
              </p>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <BarChart2 className="h-4 w-4" />
                Thank You Page Pixel ID
              </Label>
              <Input
                value={form.thankyou_pixel_id}
                onChange={(e) => setForm({ ...form, thankyou_pixel_id: e.target.value })}
                placeholder="123456789012345"
              />
              <p className="text-xs text-muted-foreground">
                This pixel fires on form submissions or purchase confirmations. Used for Lead/Purchase events.
              </p>
            </div>

            <div className="p-3 bg-muted rounded-lg text-sm">
              <p className="font-medium mb-1">How to get your Pixel ID:</p>
              <ol className="list-decimal list-inside text-xs text-muted-foreground space-y-1">
                <li>Go to Meta Events Manager</li>
                <li>Select your Pixel or create a new one</li>
                <li>Copy the 15-16 digit Pixel ID</li>
              </ol>
            </div>
          </TabsContent>

          <TabsContent value="code" className="space-y-4">
            {form.header_pixel_id ? (
              <>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Code className="h-4 w-4" />
                    Header Code (Auto-injected)
                  </Label>
                  <pre className="p-3 bg-muted rounded-lg text-xs overflow-x-auto max-h-48">
                    {headerCode}
                  </pre>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      navigator.clipboard.writeText(headerCode);
                      toast.success("Header code copied!");
                    }}
                  >
                    Copy Header Code
                  </Button>
                </div>

                {form.thankyou_pixel_id && (
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Code className="h-4 w-4" />
                      Conversion Code (Thank You Page)
                    </Label>
                    <pre className="p-3 bg-muted rounded-lg text-xs overflow-x-auto">
                      {thankyouCode}
                    </pre>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        navigator.clipboard.writeText(thankyouCode);
                        toast.success("Conversion code copied!");
                      }}
                    >
                      Copy Conversion Code
                    </Button>
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">
                Enter your Pixel ID in the Setup tab to generate tracking code
              </p>
            )}
          </TabsContent>
        </Tabs>

        <div className="flex justify-end">
          <Button onClick={() => savePixel.mutate()} disabled={savePixel.isPending}>
            {savePixel.isPending ? "Saving..." : "Save Pixel Settings"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
