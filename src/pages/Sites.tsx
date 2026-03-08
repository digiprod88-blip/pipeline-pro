import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Plus, Globe, Eye, Users, Pencil, Trash2, ExternalLink, Copy } from "lucide-react";
import { format } from "date-fns";

export default function Sites() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPage, setEditingPage] = useState<any>(null);
  const [form, setForm] = useState({ title: "", slug: "", description: "", meta_title: "", meta_description: "", template: "blank" });

  const { data: pages = [], isLoading } = useQuery({
    queryKey: ["landing-pages"],
    queryFn: async () => {
      const { data, error } = await supabase.from("landing_pages").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const createMutation = useMutation({
    mutationFn: async (values: typeof form) => {
      const slug = values.slug || values.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
      const { error } = await supabase.from("landing_pages").insert({ ...values, slug, user_id: user!.id });
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["landing-pages"] }); setDialogOpen(false); resetForm(); toast.success("Page created"); },
    onError: (e: any) => toast.error(e.message),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...values }: any) => {
      const { error } = await supabase.from("landing_pages").update(values).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["landing-pages"] }); setDialogOpen(false); setEditingPage(null); resetForm(); toast.success("Page updated"); },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("landing_pages").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["landing-pages"] }); toast.success("Page deleted"); },
    onError: (e: any) => toast.error(e.message),
  });

  const togglePublish = useMutation({
    mutationFn: async ({ id, is_published }: { id: string; is_published: boolean }) => {
      const { error } = await supabase.from("landing_pages").update({ is_published }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["landing-pages"] }); toast.success("Status updated"); },
  });

  const resetForm = () => setForm({ title: "", slug: "", description: "", meta_title: "", meta_description: "", template: "blank" });

  const openEdit = (page: any) => {
    setEditingPage(page);
    setForm({ title: page.title, slug: page.slug, description: page.description || "", meta_title: page.meta_title || "", meta_description: page.meta_description || "", template: page.template || "blank" });
    setDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!form.title.trim()) return toast.error("Title required");
    if (editingPage) {
      updateMutation.mutate({ id: editingPage.id, ...form });
    } else {
      createMutation.mutate(form);
    }
  };

  const copyUrl = (slug: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/p/${slug}`);
    toast.success("URL copied!");
  };

  const templates = [
    { id: "blank", label: "Blank Page" },
    { id: "lead-capture", label: "Lead Capture" },
    { id: "webinar", label: "Webinar Registration" },
    { id: "product-launch", label: "Product Launch" },
  ];

  const totalViews = pages.reduce((s: number, p: any) => s + (p.views_count || 0), 0);
  const totalLeads = pages.reduce((s: number, p: any) => s + (p.leads_count || 0), 0);
  const publishedCount = pages.filter((p: any) => p.is_published).length;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Landing Pages</h1>
          <p className="text-muted-foreground text-sm">Create & manage landing pages for lead capture</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) { setEditingPage(null); resetForm(); } }}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" />New Page</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editingPage ? "Edit Page" : "Create Landing Page"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div><Label>Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="My Landing Page" /></div>
              <div><Label>Slug (URL path)</Label><Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder="auto-generated-from-title" /></div>
              <div><Label>Description</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} /></div>
              <div><Label>Template</Label>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  {templates.map((t) => (
                    <button key={t.id} onClick={() => setForm({ ...form, template: t.id })} className={`p-3 rounded-lg border text-sm text-left transition-colors ${form.template === t.id ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-muted-foreground"}`}>
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
              <div><Label>Meta Title (SEO)</Label><Input value={form.meta_title} onChange={(e) => setForm({ ...form, meta_title: e.target.value })} /></div>
              <div><Label>Meta Description (SEO)</Label><Textarea value={form.meta_description} onChange={(e) => setForm({ ...form, meta_description: e.target.value })} rows={2} /></div>
              <Button className="w-full" onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending}>
                {editingPage ? "Update Page" : "Create Page"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><Globe className="h-8 w-8 text-primary" /><div><p className="text-2xl font-bold">{pages.length}</p><p className="text-sm text-muted-foreground">Total Pages</p></div></div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><Eye className="h-8 w-8 text-blue-500" /><div><p className="text-2xl font-bold">{totalViews}</p><p className="text-sm text-muted-foreground">Total Views</p></div></div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><Users className="h-8 w-8 text-green-500" /><div><p className="text-2xl font-bold">{totalLeads}</p><p className="text-sm text-muted-foreground">Leads Captured</p></div></div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><Globe className="h-8 w-8 text-orange-500" /><div><p className="text-2xl font-bold">{publishedCount}</p><p className="text-sm text-muted-foreground">Published</p></div></div></CardContent></Card>
      </div>

      {/* Pages List */}
      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Loading...</div>
      ) : pages.length === 0 ? (
        <Card><CardContent className="py-12 text-center"><Globe className="h-12 w-12 mx-auto text-muted-foreground mb-4" /><p className="text-muted-foreground">No landing pages yet. Create your first one!</p></CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {pages.map((page: any) => (
            <Card key={page.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-base truncate">{page.title}</CardTitle>
                    <p className="text-xs text-muted-foreground mt-1 truncate">/p/{page.slug}</p>
                  </div>
                  <Badge variant={page.is_published ? "default" : "secondary"}>
                    {page.is_published ? "Published" : "Draft"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {page.description && <p className="text-sm text-muted-foreground line-clamp-2">{page.description}</p>}
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1"><Eye className="h-3.5 w-3.5" />{page.views_count || 0}</span>
                  <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" />{page.leads_count || 0} leads</span>
                </div>
                <p className="text-xs text-muted-foreground">{format(new Date(page.created_at), "dd MMM yyyy")}</p>
                <div className="flex items-center gap-1 pt-2 border-t border-border">
                  <Switch checked={page.is_published} onCheckedChange={(checked) => togglePublish.mutate({ id: page.id, is_published: checked })} />
                  <span className="text-xs text-muted-foreground ml-1 mr-auto">{page.is_published ? "Live" : "Draft"}</span>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => copyUrl(page.slug)}><Copy className="h-3.5 w-3.5" /></Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(page)}><Pencil className="h-3.5 w-3.5" /></Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteMutation.mutate(page.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
