"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type Product = {
  id: string;
  name: string;
  description: string;
  price: number;
  stocks: {
    id: string;
    warehouseId: string;
    totalQuantity: number;
    reservedQuantity: number;
    availableQuantity: number;
    warehouse: { id: string; name: string; location: string };
  }[];
};

export default function ProductListingPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [reserving, setReserving] = useState<string | null>(null);
  const router = useRouter();

  const fetchProducts = async () => {
    try {
      const res = await fetch("/api/products");
      if (res.ok) {
        const data = await res.json();
        setProducts(data);
      }
    } catch (e) {
      toast.error("Failed to fetch products");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
    const interval = setInterval(fetchProducts, 5000); // Live poll every 5s
    return () => clearInterval(interval);
  }, []);

  const handleReserve = async (productId: string, warehouseId: string) => {
    setReserving(`${productId}-${warehouseId}`);
    try {
      const idempotencyKey = crypto.randomUUID();
      const res = await fetch("/api/reservations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify({ productId, warehouseId, quantity: 1 }),
      });

      const data = await res.json();

      if (res.status === 201) {
        toast.success("Stock reserved!");
        router.push(`/checkout/${data.reservation.id}`);
      } else if (res.status === 409) {
        toast.error("Not enough stock available. Someone might have just taken the last item!");
        fetchProducts(); // Refresh immediately
      } else {
        toast.error(data.error || "Failed to reserve stock");
      }
    } catch (e) {
      toast.error("An error occurred during reservation");
    } finally {
      setReserving(null);
    }
  };

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <p className="text-sm text-neutral-500 uppercase tracking-widest animate-pulse">Loading Catalog...</p>
      </div>
    );
  }

  return (
    <div className="space-y-12 animate-in fade-in duration-700">
      <header className="space-y-4">
        <h1 className="text-4xl md:text-5xl font-black tracking-tight uppercase">Essentials</h1>
        <p className="text-neutral-500 max-w-xl text-lg">
          Select an item from our warehouses. Once reserved, you have 10 minutes to complete the checkout.
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {products.map((p) => (
          <Card key={p.id} className="rounded-none border-2 border-black dark:border-white shadow-[8px_8px_0_0_#000] dark:shadow-[8px_8px_0_0_#fff] transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[6px_6px_0_0_#000] dark:hover:shadow-[6px_6px_0_0_#fff]">
            <CardHeader>
              <CardTitle className="text-2xl font-bold tracking-tight">{p.name}</CardTitle>
              <CardDescription className="text-black/60 dark:text-white/60">{p.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="text-3xl font-black">₹{(p.price * 100).toFixed(2)}</div>
              
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-widest text-neutral-500">Availability</h4>
                {p.stocks.map((s) => (
                  <div key={s.id} className="flex flex-col gap-2 p-3 border border-black/10 dark:border-white/10">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold">{s.warehouse.name}</span>
                      {s.availableQuantity > 0 ? (
                        <Badge variant="outline" className="border-black dark:border-white rounded-none">{s.availableQuantity} in stock</Badge>
                      ) : (
                        <Badge variant="secondary" className="rounded-none">Out of stock</Badge>
                      )}
                    </div>
                    
                    <Button 
                      className="w-full rounded-none font-bold uppercase tracking-wider" 
                      variant="default"
                      disabled={s.availableQuantity <= 0 || reserving === `${p.id}-${s.warehouseId}`}
                      onClick={() => handleReserve(p.id, s.warehouseId)}
                    >
                      {reserving === `${p.id}-${s.warehouseId}` ? "Reserving..." : "Reserve"}
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
