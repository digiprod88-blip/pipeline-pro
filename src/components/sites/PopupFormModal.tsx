import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface PopupFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pageId: string;
  formConfig?: {
    title?: string;
    nameLabel?: string;
    emailLabel?: string;
    phoneLabel?: string;
    buttonText?: string;
    showPhone?: boolean;
  };
  onSuccess?: () => void;
}

export function PopupFormModal({ open, onOpenChange, pageId, formConfig, onSuccess }: PopupFormModalProps) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
  });

  const config = {
    title: formConfig?.title || "Get Started",
    nameLabel: formConfig?.nameLabel || "Your Name",
    emailLabel: formConfig?.emailLabel || "Email Address",
    phoneLabel: formConfig?.phoneLabel || "Phone Number",
    buttonText: formConfig?.buttonText || "Submit",
    showPhone: formConfig?.showPhone ?? false,
  };

  const submitMutation = useMutation({
    mutationFn: async () => {
      // Create contact via the webhook-lead function (which doesn't require auth)
      const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/webhook-lead`;
      
      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name: form.name.split(" ")[0] || form.name,
          last_name: form.name.split(" ").slice(1).join(" ") || null,
          email: form.email,
          phone: form.phone || null,
          source: `landing_page_${pageId}`,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to submit form");
      }

      // Increment leads count on the landing page
      await supabase.rpc("increment_landing_page_leads", { page_id: pageId }).catch(() => {
        // RPC might not exist, ignore
      });
    },
    onSuccess: () => {
      toast.success("Thank you! We'll be in touch soon.");
      setForm({ name: "", email: "", phone: "" });
      onOpenChange(false);
      onSuccess?.();
    },
    onError: () => {
      toast.error("Something went wrong. Please try again.");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim()) {
      toast.error("Please fill in all required fields");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      toast.error("Please enter a valid email address");
      return;
    }
    submitMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{config.title}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="popup-name">{config.nameLabel}</Label>
            <Input
              id="popup-name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="John Doe"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="popup-email">{config.emailLabel}</Label>
            <Input
              id="popup-email"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="john@example.com"
              required
            />
          </div>
          {config.showPhone && (
            <div className="space-y-2">
              <Label htmlFor="popup-phone">{config.phoneLabel}</Label>
              <Input
                id="popup-phone"
                type="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="+1 (555) 000-0000"
              />
            </div>
          )}
          <Button type="submit" className="w-full" disabled={submitMutation.isPending}>
            {submitMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {config.buttonText}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
