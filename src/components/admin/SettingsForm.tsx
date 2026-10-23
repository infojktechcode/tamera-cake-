"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { updateSettings } from "@/app/admin/settings/actions";

interface SettingsFormProps {
  initialSettings: any;
}

export function SettingsForm({ initialSettings }: SettingsFormProps) {
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    try {
      const res = await updateSettings(formData);
      if (res.success) {
        toast.success("Settings updated successfully");
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="p-6 bg-white border-cocoa/10 max-w-2xl mx-auto">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label>Shop WhatsApp Number</Label>
            <Input
              name="whatsapp_number"
              defaultValue={initialSettings.whatsapp_number}
              placeholder="+254..."
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Daily Cake Limit</Label>
            <Input
              name="daily_cake_limit"
              type="number"
              defaultValue={initialSettings.daily_cake_limit}
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Deposit Percentage (%)</Label>
            <Input
              name="deposit_percent"
              type="number"
              defaultValue={initialSettings.deposit_percent}
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Minimum Lead Days</Label>
            <Input
              name="min_lead_days"
              type="number"
              defaultValue={initialSettings.min_lead_days}
              required
            />
          </div>
        </div>
        <div className="flex justify-end">
          <Button type="submit" disabled={loading}>
            {loading ? "Saving..." : "Save All Settings"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
