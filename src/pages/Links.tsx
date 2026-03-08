import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Plus, Link2, MousePointerClick, BarChart3, Copy, Trash2, ExternalLink, Globe, Smartphone, Monitor, Tablet } from "lucide-react";
import { format } from "date-fns";

function generateShortCode() {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

export default function Links() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedLink, setSelectedLink] = useState<string | null>(null);
  const [form, setForm] = useState({ original_url: "", title: "", short_code: "", utm_source: "", utm_medium: "", utm_campaign: "", utm_content: "" });

  const { data: links = [], isLoading } = useQuery({
    queryKey: ["short-links"],
    queryFn: async () => {
      const { data, error } = await supabase.from("short_links").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: clicks = [] } = useQuery({
    queryKey: ["link-clicks", selectedLink],
    queryFn: async () => {
      if (!selectedLink) return [];
      const { data, error } = await supabase.from("link_clicks").select("*").eq("link_id", selectedLink).order("created_at", { ascending: false }).limit(100);
      if (error) throw error;
      return data;
    },
    enabled: !!selectedLink,
  });

  const createMutation = useMutation({
    mutationFn: async (values: typeof form) => {
      const short_code = values.short_code || generateShortCode();
      const { error } = await supabase.from("short_links").insert({ ...values, short_code, user_id: user!.id });
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["short-links"] }); setDialogOpen(false); resetForm(); toast.success("Link created"); },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("short_links").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["short-links"] }); if (selectedLink) setSelectedLink(null); toast.success("Link deleted"); },
    onError: (e: any) => toast.error(e.message),
  });

  const resetForm = () => setForm({ original_url: "", title: "", short_code: "", utm_source: "", utm_medium: "", utm_campaign: "", utm_content: "" });

  const handleSubmit = () => {
    if (!form.original_url.trim()) return toast.error("URL required");
    createMutation.mutate(form);
  };

  const copyShortUrl = (code: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/l/${code}`);
    toast.success("Short URL copied!");
  };

  const totalClicks = links.reduce((s: number, l: any) => s + (l.clicks_count || 0), 0);
  const activeLinks = links.filter((l: any) => l.is_active).length;

  const deviceBreakdown = clicks.reduce((acc: Record<string, number>, c: any) => {
    const d = c.device_type || "unknown";
    acc[d] = (acc[d] || 0) + 1;
    return acc;
  }, {});

  const browserBreakdown = clicks.reduce((acc: Record<string, number>, c: any) => {
    const b = c.browser || "unknown";
    acc[b] = (acc[b] || 0) + 1;
    return acc;
  }, {});

  const selectedLinkData = links.find((l: any) => l.id === selectedLink);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Link Shortener</h1>
          <p className="text-muted-foreground text-sm">Create short links with UTM tracking & click analytics</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" />New Link</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Create Short Link</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><Label>Destination URL *</Label><Input value={form.original_url} onChange={(e) => setForm({ ...form, original_url: e.target.value })} placeholder="https://example.com/my-page" /></div>
              <div><Label>Title (optional)</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Campaign link" /></div>
              <div><Label>Custom Short Code (optional)</Label><Input value={form.short_code} onChange={(e) => setForm({ ...form, short_code: e.target.value })} placeholder="auto-generated" /></div>
              <div className="border-t border-border pt-4"><p className="text-sm font-medium mb-3">UTM Parameters</p>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label className="text-xs">Source</Label><Input value={form.utm_source} onChange={(e) => setForm({ ...form, utm_source: e.target.value })} placeholder="facebook" className="h-8 text-sm" /></div>
                  <div><Label className="text-xs">Medium</Label><Input value={form.utm_medium} onChange={(e) => setForm({ ...form, utm_medium: e.target.value })} placeholder="cpc" className="h-8 text-sm" /></div>
                  <div><Label className="text-xs">Campaign</Label><Input value={form.utm_campaign} onChange={(e) => setForm({ ...form, utm_campaign: e.target.value })} placeholder="spring_sale" className="h-8 text-sm" /></div>
                  <div><Label className="text-xs">Content</Label><Input value={form.utm_content} onChange={(e) => setForm({ ...form, utm_content: e.target.value })} placeholder="banner_ad" className="h-8 text-sm" /></div>
                </div>
              </div>
              <Button className="w-full" onClick={handleSubmit} disabled={createMutation.isPending}>Create Link</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><Link2 className="h-8 w-8 text-primary" /><div><p className="text-2xl font-bold">{links.length}</p><p className="text-sm text-muted-foreground">Total Links</p></div></div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><MousePointerClick className="h-8 w-8 text-blue-500" /><div><p className="text-2xl font-bold">{totalClicks}</p><p className="text-sm text-muted-foreground">Total Clicks</p></div></div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><BarChart3 className="h-8 w-8 text-green-500" /><div><p className="text-2xl font-bold">{activeLinks}</p><p className="text-sm text-muted-foreground">Active Links</p></div></div></CardContent></Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Links List */}
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-base">All Links</CardTitle></CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-muted-foreground text-center py-8">Loading...</p>
            ) : links.length === 0 ? (
              <div className="text-center py-8"><Link2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" /><p className="text-muted-foreground">No links yet</p></div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Link</TableHead>
                    <TableHead>Clicks</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="w-[100px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {links.map((link: any) => (
                    <TableRow key={link.id} className={`cursor-pointer ${selectedLink === link.id ? "bg-muted/50" : ""}`} onClick={() => setSelectedLink(link.id)}>
                      <TableCell>
                        <div>
                          <p className="font-medium text-sm">{link.title || link.short_code}</p>
                          <p className="text-xs text-muted-foreground truncate max-w-[250px]">{link.original_url}</p>
                          <div className="flex items-center gap-1 mt-1">
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0">/l/{link.short_code}</Badge>
                            {link.utm_source && <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{link.utm_source}</Badge>}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell><span className="font-semibold">{link.clicks_count || 0}</span></TableCell>
                      <TableCell className="text-xs text-muted-foreground">{format(new Date(link.created_at), "dd MMM")}</TableCell>
                      <TableCell>
                        <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => copyShortUrl(link.short_code)}><Copy className="h-3.5 w-3.5" /></Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteMutation.mutate(link.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Click Analytics Panel */}
        <Card>
          <CardHeader><CardTitle className="text-base">Click Analytics</CardTitle></CardHeader>
          <CardContent>
            {!selectedLink ? (
              <p className="text-muted-foreground text-sm text-center py-8">Select a link to view analytics</p>
            ) : (
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-medium">{selectedLinkData?.title || selectedLinkData?.short_code}</p>
                  <p className="text-xs text-muted-foreground">{selectedLinkData?.clicks_count || 0} total clicks</p>
                </div>

                {/* Device Breakdown */}
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">DEVICES</p>
                  {Object.entries(deviceBreakdown).length === 0 ? (
                    <p className="text-xs text-muted-foreground">No click data yet</p>
                  ) : (
                    <div className="space-y-2">
                      {Object.entries(deviceBreakdown).map(([device, count]) => (
                        <div key={device} className="flex items-center justify-between text-sm">
                          <span className="flex items-center gap-2 capitalize">
                            {device === "mobile" ? <Smartphone className="h-3.5 w-3.5" /> : device === "tablet" ? <Tablet className="h-3.5 w-3.5" /> : <Monitor className="h-3.5 w-3.5" />}
                            {device}
                          </span>
                          <span className="font-medium">{count as number}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Browser Breakdown */}
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">BROWSERS</p>
                  {Object.entries(browserBreakdown).length === 0 ? (
                    <p className="text-xs text-muted-foreground">No click data yet</p>
                  ) : (
                    <div className="space-y-2">
                      {Object.entries(browserBreakdown).map(([browser, count]) => (
                        <div key={browser} className="flex items-center justify-between text-sm">
                          <span className="capitalize flex items-center gap-2"><Globe className="h-3.5 w-3.5" />{browser}</span>
                          <span className="font-medium">{count as number}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Recent Clicks */}
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">RECENT CLICKS</p>
                  <div className="space-y-2 max-h-[200px] overflow-y-auto">
                    {clicks.slice(0, 10).map((click: any) => (
                      <div key={click.id} className="text-xs border border-border rounded p-2">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">{click.country || "Unknown"}</span>
                          <span className="text-muted-foreground">{format(new Date(click.created_at), "dd MMM HH:mm")}</span>
                        </div>
                        <p className="text-muted-foreground mt-1">{click.device_type || "?"} • {click.browser || "?"} • {click.os || "?"}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
