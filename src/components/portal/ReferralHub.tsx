import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Gift, Link2, Copy, Users, Star, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface ReferralHubProps {
  contactId: string;
}

export function ReferralHub({ contactId }: ReferralHubProps) {
  const referralLink = `${window.location.origin}/book/ref?code=${contactId.slice(0, 8)}`;

  const { data: referrals } = useQuery({
    queryKey: ["client-referrals", contactId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("referrals")
        .select("*")
        .eq("referrer_contact_id", contactId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!contactId,
  });

  const copyLink = () => {
    navigator.clipboard.writeText(referralLink);
    toast.success("Referral link copied!");
  };

  const totalReferrals = referrals?.length ?? 0;
  const converted = referrals?.filter((r) => r.status === "converted").length ?? 0;
  const totalCredits = referrals?.reduce((s, r) => s + (r.reward_credits ?? 0), 0) ?? 0;

  return (
    <div className="space-y-6">
      {/* Referral Link Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Link2 className="h-4 w-4" /> Your Referral Link
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Share this link with friends. When they sign up, you earn rewards!
          </p>
          <div className="flex gap-2">
            <Input value={referralLink} readOnly className="text-sm" />
            <Button variant="outline" onClick={copyLink}>
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Referrals</p>
                <p className="text-lg font-semibold">{totalReferrals}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-success/10 flex items-center justify-center">
                <CheckCircle2 className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Converted</p>
                <p className="text-lg font-semibold">{converted}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-warning/10 flex items-center justify-center">
                <Star className="h-5 w-5 text-warning" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Reward Credits</p>
                <p className="text-lg font-semibold">{totalCredits}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Referrals List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Gift className="h-4 w-4" /> Referral History
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {totalReferrals === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6">
              No referrals yet. Share your link to start earning rewards!
            </p>
          )}
          {referrals?.map((ref) => (
            <div key={ref.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
              <div>
                <p className="text-sm font-medium">{ref.referred_name || "Unknown"}</p>
                <p className="text-xs text-muted-foreground">
                  {ref.referred_email || "No email"} · {format(new Date(ref.created_at), "MMM d, yyyy")}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {ref.reward_credits > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    +{ref.reward_credits} credits
                  </Badge>
                )}
                <Badge
                  variant={ref.status === "converted" ? "success" : ref.status === "pending" ? "warning" : "secondary"}
                  className="text-xs capitalize"
                >
                  {ref.status}
                </Badge>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
