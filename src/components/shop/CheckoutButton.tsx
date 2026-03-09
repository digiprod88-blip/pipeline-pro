import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ShoppingCart, CreditCard } from "lucide-react";
import { toast } from "sonner";

interface CheckoutButtonProps {
  product: {
    id: string;
    name: string;
    price: number;
    currency: string;
  };
  shopSettings: {
    payment_gateway: string;
    razorpay_key_id?: string | null;
    stripe_publishable_key?: string | null;
  } | null;
}

export function CheckoutButton({ product, shopSettings }: CheckoutButtonProps) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [contactId, setContactId] = useState("");
  const [processing, setProcessing] = useState(false);

  const gateway = shopSettings?.payment_gateway || "none";
  const canPay = gateway !== "none";

  const handleCheckout = async () => {
    if (!user) return toast.error("Please log in");
    setProcessing(true);

    try {
      // Create order first
      const { data: order, error: orderErr } = await supabase.from("orders").insert({
        user_id: user.id,
        product_id: product.id,
        contact_id: contactId || null,
        amount: product.price,
        currency: product.currency,
        status: "pending",
      }).select().single();

      if (orderErr) throw orderErr;

      const chosenGateway = gateway === "both"
        ? (product.currency === "INR" ? "razorpay" : "stripe")
        : gateway;

      // Call create-payment edge function
      const { data: paymentData, error: payErr } = await supabase.functions.invoke("create-payment", {
        body: {
          gateway: chosenGateway,
          amount: product.price,
          currency: product.currency,
          product_id: product.id,
          product_name: product.name,
          order_id: order.id,
        },
      });

      if (payErr) throw payErr;

      if (chosenGateway === "razorpay" && paymentData?.order_id) {
        // Load Razorpay
        const script = document.createElement("script");
        script.src = "https://checkout.razorpay.com/v1/checkout.js";
        script.onload = () => {
          const options = {
            key: paymentData.key_id,
            amount: paymentData.amount,
            currency: paymentData.currency,
            name: product.name,
            order_id: paymentData.order_id,
            handler: async (response: any) => {
              // Verify payment
              const { data: verifyData, error: verifyErr } = await supabase.functions.invoke("verify-payment", {
                body: {
                  gateway: "razorpay",
                  order_id: order.id,
                  payment_id: response.razorpay_payment_id,
                  signature: response.razorpay_signature,
                  razorpay_order_id: response.razorpay_order_id,
                },
              });
              if (verifyErr || !verifyData?.verified) {
                toast.error("Payment verification failed");
              } else {
                toast.success("Payment successful! 🎉");
                // Fire Meta Purchase pixel
                if (typeof (window as any).fbq === "function") {
                  (window as any).fbq("track", "Purchase", {
                    value: product.price,
                    currency: product.currency,
                  });
                }
                setOpen(false);
              }
            },
            prefill: {},
            theme: { color: "#6366f1" },
          };
          const rzp = new (window as any).Razorpay(options);
          rzp.open();
        };
        document.body.appendChild(script);
      } else if (chosenGateway === "stripe" && paymentData?.client_secret) {
        // For Stripe, we'd need @stripe/stripe-js - show a simple confirmation for now
        toast.info("Stripe checkout initiated. Client secret received.");
        // In production, use Stripe Elements here
      }
    } catch (e: any) {
      toast.error(e.message || "Checkout failed");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)} disabled={!canPay}>
        <ShoppingCart className="h-3.5 w-3.5 mr-1" />
        {canPay ? "Buy Now" : "No Payment Gateway"}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Checkout: {product.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-4 rounded-lg bg-secondary/50 text-center">
              <p className="text-2xl font-bold">
                {product.currency === "INR" ? "₹" : "$"}{Number(product.price).toLocaleString()}
              </p>
              <p className="text-sm text-muted-foreground">{product.currency}</p>
            </div>
            <div>
              <Label className="text-xs">Contact ID (optional)</Label>
              <Input value={contactId} onChange={(e) => setContactId(e.target.value)} placeholder="Link to contact..." className="text-sm" />
            </div>
            <div className="text-xs text-muted-foreground">
              Gateway: <span className="font-medium capitalize">{gateway === "both" ? (product.currency === "INR" ? "Razorpay" : "Stripe") : gateway}</span>
            </div>
            <Button className="w-full" onClick={handleCheckout} disabled={processing}>
              {processing ? "Processing..." : "Pay Now"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
