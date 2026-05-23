"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function CheckoutPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [reservation, setReservation] = useState<any>(null);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (!id) return;
    const fetchRes = async () => {
      try {
        const res = await fetch(`/api/reservations/${id}`);
        if (res.ok) {
          const data = await res.json();
          setReservation(data);
          const expiresAt = new Date(data.expiresAt).getTime();
          const now = Date.now();
          setTimeLeft(Math.max(0, Math.floor((expiresAt - now) / 1000)));
        } else {
          toast.error("Reservation not found");
          router.push("/");
        }
      } catch (e) {
        toast.error("Error fetching reservation");
      } finally {
        setLoading(false);
      }
    };
    fetchRes();
  }, [id, router]);

  useEffect(() => {
    if (timeLeft <= 0) return;
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          // Only toast if it was pending
          if (reservation?.status === 'PENDING') {
            toast.error("Reservation expired!");
            // Optionally auto-refresh or mark expired in UI
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [timeLeft, reservation]);

  const handleConfirm = async () => {
    setProcessing(true);
    try {
      const idempotencyKey = crypto.randomUUID();
      const res = await fetch(`/api/reservations/${id}/confirm`, {
        method: "POST",
        headers: { "Idempotency-Key": idempotencyKey },
      });
      const data = await res.json();
      
      if (res.ok) {
        toast.success("Payment successful! Order confirmed.");
        setReservation((prev: any) => ({ ...prev, status: "CONFIRMED" }));
      } else if (res.status === 410) {
        toast.error(data.error || "Reservation expired.");
        setReservation((prev: any) => ({ ...prev, status: "RELEASED" }));
      } else {
        toast.error(data.error || "Failed to confirm.");
      }
    } catch (e) {
      toast.error("An error occurred");
    } finally {
      setProcessing(false);
    }
  };

  const handleCancel = async () => {
    setProcessing(true);
    try {
      const res = await fetch(`/api/reservations/${id}/release`, {
        method: "POST"
      });
      if (res.ok) {
        toast.success("Reservation cancelled.");
        router.push("/");
      } else {
        toast.error("Failed to cancel reservation.");
      }
    } catch (e) {
      toast.error("An error occurred");
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <p className="text-sm text-neutral-500 uppercase tracking-widest animate-pulse">Loading Checkout...</p>
      </div>
    );
  }

  if (!reservation) return null;

  const isExpired = timeLeft === 0 && reservation.status === 'PENDING';
  const isConfirmed = reservation.status === 'CONFIRMED';
  const isReleased = reservation.status === 'RELEASED';

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const timeString = `${minutes}:${seconds.toString().padStart(2, '0')}`;

  return (
    <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 mt-12">
      <header className="space-y-2 text-center">
        <h1 className="text-3xl md:text-4xl font-black tracking-tight uppercase">Checkout</h1>
        <p className="text-neutral-500">Complete your purchase to secure your item.</p>
      </header>

      <Card className="rounded-none border-4 border-black dark:border-white shadow-[12px_12px_0_0_#000] dark:shadow-[12px_12px_0_0_#fff]">
        <CardHeader className="border-b-4 border-black dark:border-white bg-neutral-100 dark:bg-neutral-900">
          <CardTitle className="text-center font-mono text-xl">
            {isConfirmed ? (
              <span className="text-green-600 dark:text-green-400">Order Confirmed ✓</span>
            ) : isReleased || isExpired ? (
              <span className="text-red-600 dark:text-red-400">Reservation Expired ✗</span>
            ) : (
              <span className="tabular-nums">Time remaining: {timeString}</span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-8 space-y-6">
          <div className="flex justify-between items-start border-b border-dashed border-black/20 dark:border-white/20 pb-6">
            <div>
              <h3 className="text-2xl font-bold">{reservation.product.name}</h3>
              <p className="text-neutral-500 mt-1">From: {reservation.warehouse.name}</p>
              <p className="text-sm text-neutral-400 mt-1">Qty: {reservation.quantity}</p>
            </div>
            <div className="text-2xl font-black">
              ${(reservation.product.price * reservation.quantity).toFixed(2)}
            </div>
          </div>
          
          <div className="flex justify-between items-center text-lg font-bold pt-2">
            <span>Total</span>
            <span>${(reservation.product.price * reservation.quantity).toFixed(2)}</span>
          </div>
        </CardContent>
        <CardFooter className="grid grid-cols-2 gap-4 p-8 pt-0">
          <Button 
            variant="outline" 
            className="rounded-none border-2 border-black dark:border-white uppercase font-bold tracking-wider"
            onClick={isConfirmed || isReleased || isExpired ? () => router.push("/") : handleCancel}
            disabled={processing}
          >
            {isConfirmed || isReleased || isExpired ? "Back to Shop" : "Cancel"}
          </Button>
          {!isConfirmed && !isReleased && !isExpired && (
            <Button 
              className="rounded-none bg-black text-white hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-200 uppercase font-bold tracking-wider"
              onClick={handleConfirm}
              disabled={processing}
            >
              {processing ? "Processing..." : "Pay Now"}
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
