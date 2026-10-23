"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { recordPayment } from "./actions";

interface PaymentModalProps {
  orderId: string;
  orderNumber: string;
  currentPaid: number;
  total: number;
  onClose: () => void;
}

export function PaymentModal({ orderId, orderNumber, currentPaid, total, onClose }: PaymentModalProps) {
  const [loading, setLoading] = useState(false);
  const balance = total - currentPaid;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.currentTarget);

    try {
      const res = await recordPayment(formData);
      if (res.success) {
        toast.success(`Payment recorded for ${orderNumber}`);
        onClose();
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to record payment");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <Card className="w-full max-w-md p-6 shadow-2xl">
        <div className="mb-6">
          <h3 className="font-display text-xl font-bold">Record Payment</h3>
          <p className="text-sm text-ink-muted">Order {orderNumber} • Balance: KES {balance}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input type="hidden" name="orderId" value={orderId} />

          <div className="space-y-2">
            <Label htmlFor="amount">Amount (KES)</Label>
            <Input
              id="amount"
              name="amount"
              type="number"
              placeholder="Enter amount"
              required
              defaultValue={balance}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="method">Method</Label>
            <select
              id="method"
              name="method"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
              required
            >
              <option value="mpesa">M-Pesa</option>
              <option value="cash">Cash</option>
              <option value="bank">Bank Transfer</option>
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reference">Reference / Transaction Code</Label>
            <Input id="reference" name="reference" placeholder="e.g. RKL7S2X1" />
          </div>

          <div className="flex gap-3 pt-4">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" className="flex-1" disabled={loading}>
              {loading ? "Recording..." : "Save Payment"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
