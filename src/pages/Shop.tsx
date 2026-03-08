import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Package, ShoppingCart, Trash2, DollarSign, IndianRupee, FileDown } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { downloadInvoice } from "@/lib/invoice";

export default function Shop() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [openProduct, setOpenProduct] = useState(false);

  const [productForm, setProductForm] = useState({
    name: "", description: "", price: 0, currency: "INR", product_type: "digital", image_url: "",
  });

  const { data: products } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: orders } = useQuery({
    queryKey: ["orders"],
    queryFn: async () => {
      const { data, error } = await supabase.from("orders").select("*, products(name), contacts(first_name, last_name)").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const createProduct = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("products").insert({
        user_id: user!.id,
        name: productForm.name,
        description: productForm.description || null,
        price: productForm.price,
        currency: productForm.currency,
        product_type: productForm.product_type,
        image_url: productForm.image_url || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      setOpenProduct(false);
      setProductForm({ name: "", description: "", price: 0, currency: "INR", product_type: "digital", image_url: "" });
      toast.success("Product created!");
    },
  });

  const toggleProduct = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("products").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
    },
  });

  const deleteProduct = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("products").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success("Product deleted");
    },
  });

  const totalRevenue = orders?.filter(o => o.status === "paid").reduce((s, o) => s + Number(o.amount), 0) || 0;
  const pendingOrders = orders?.filter(o => o.status === "pending").length || 0;

  const CurrencyIcon = productForm.currency === "INR" ? IndianRupee : DollarSign;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Shop & Products</h1>
          <p className="text-muted-foreground text-sm">Manage products and track orders</p>
        </div>
        <Dialog open={openProduct} onOpenChange={setOpenProduct}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" />Add Product</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create Product</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><Label>Name</Label><Input value={productForm.name} onChange={e => setProductForm({ ...productForm, name: e.target.value })} placeholder="Product name" /></div>
              <div><Label>Description</Label><Textarea value={productForm.description} onChange={e => setProductForm({ ...productForm, description: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label>Price</Label><Input type="number" min={0} value={productForm.price} onChange={e => setProductForm({ ...productForm, price: parseFloat(e.target.value) || 0 })} /></div>
                <div>
                  <Label>Currency</Label>
                  <Select value={productForm.currency} onValueChange={v => setProductForm({ ...productForm, currency: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="INR">INR (₹)</SelectItem>
                      <SelectItem value="USD">USD ($)</SelectItem>
                      <SelectItem value="EUR">EUR (€)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Type</Label>
                <Select value={productForm.product_type} onValueChange={v => setProductForm({ ...productForm, product_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="digital">Digital</SelectItem>
                    <SelectItem value="service">Service</SelectItem>
                    <SelectItem value="physical">Physical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Image URL</Label><Input value={productForm.image_url} onChange={e => setProductForm({ ...productForm, image_url: e.target.value })} placeholder="https://..." /></div>
              <Button className="w-full" onClick={() => createProduct.mutate()} disabled={!productForm.name || createProduct.isPending}>Create Product</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold">{products?.length || 0}</p><p className="text-xs text-muted-foreground">Products</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold">{orders?.length || 0}</p><p className="text-xs text-muted-foreground">Total Orders</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold">{pendingOrders}</p><p className="text-xs text-muted-foreground">Pending</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold">₹{totalRevenue.toLocaleString()}</p><p className="text-xs text-muted-foreground">Revenue</p></CardContent></Card>
      </div>

      <Tabs defaultValue="products">
        <TabsList>
          <TabsTrigger value="products">Products</TabsTrigger>
          <TabsTrigger value="orders">Orders</TabsTrigger>
        </TabsList>

        <TabsContent value="products" className="mt-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {products?.map((product) => (
              <Card key={product.id}>
                {product.image_url && <img src={product.image_url} alt={product.name} className="w-full h-40 object-cover rounded-t-lg" />}
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-base">{product.name}</CardTitle>
                    <Switch checked={product.is_active} onCheckedChange={v => toggleProduct.mutate({ id: product.id, is_active: v })} />
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  {product.description && <p className="text-xs text-muted-foreground">{product.description}</p>}
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">{product.currency === "INR" ? "₹" : "$"}{Number(product.price).toLocaleString()}</span>
                    <div className="flex items-center gap-1">
                      <Badge variant="outline" className="capitalize text-xs">{product.product_type}</Badge>
                      <Badge variant={product.is_active ? "success" : "secondary"} className="text-xs">{product.is_active ? "Active" : "Inactive"}</Badge>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" className="w-full" onClick={() => deleteProduct.mutate(product.id)}><Trash2 className="h-3 w-3 mr-1" />Delete</Button>
                </CardContent>
              </Card>
            ))}
          </div>
          {(!products || products.length === 0) && (
            <Card className="p-12 text-center">
              <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-semibold">No products yet</h3>
              <p className="text-sm text-muted-foreground mt-1">Add your first product or service</p>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="orders" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <div className="divide-y divide-border">
                {orders?.map((order: any) => (
                  <div key={order.id} className="flex items-center justify-between p-4">
                    <div>
                      <p className="text-sm font-medium">{order.products?.name || "—"}</p>
                      <p className="text-xs text-muted-foreground">
                        {order.contacts ? `${order.contacts.first_name} ${order.contacts.last_name}` : "—"} • {format(new Date(order.created_at), "MMM d, yyyy")}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{order.currency === "INR" ? "₹" : "$"}{Number(order.amount).toLocaleString()}</span>
                      <Badge variant={order.status === "paid" ? "success" : order.status === "pending" ? "warm" : "secondary"} className="capitalize text-xs">{order.status}</Badge>
                    </div>
                  </div>
                ))}
                {(!orders || orders.length === 0) && (
                  <div className="p-8 text-center">
                    <ShoppingCart className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">No orders yet</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
