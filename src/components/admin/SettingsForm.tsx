"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { updateSettings } from "@/app/admin/settings/actions";
import type { Json } from "@/lib/database.types";

interface SettingsFormProps {
  initialSettings: {
    whatsapp_number: string;
    daily_cake_limit: number;
    deposit_percent: number;
    min_lead_days: number;
    sms_enabled: boolean;
    sms_provider: string;
    message_templates: Json;
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong.";
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
    } catch (err: unknown) {
      toast.error(errorMessage(err));
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

        <div className="border-t border-cocoa/10 pt-6 space-y-6">
          <h2 className="text-lg font-semibold">SMS Notifications</h2>
          <div className="space-y-4">
            <div className="flex items-center space-x-3">
              <input
                type="hidden"
                name="sms_enabled"
                value="off"
              />
              <input
                type="checkbox"
                name="sms_enabled"
                value="on"
                id="sms_enabled"
                defaultChecked={initialSettings.sms_enabled}
                className="h-4 w-4 rounded border-cocoa/30 text-primary focus:ring-primary"
              />
              <Label htmlFor="sms_enabled" className="cursor-pointer mb-0">
                Enable SMS notifications
              </Label>
            </div>
            <div className="space-y-2">
              <Label htmlFor="sms_provider">SMS Provider</Label>
              <select
                name="sms_provider"
                id="sms_provider"
                defaultValue={initialSettings.sms_provider}
                className="w-full rounded-md border border-cocoa/20 bg-white px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="mock">Mock (development)</option>
                <option value="africas_talking">Africa&apos;s Talking</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="message_templates">Message Templates (JSON)</Label>
              <Textarea
                name="message_templates"
                id="message_templates"
                defaultValue={JSON.stringify(initialSettings.message_templates, null, 2)}
                rows={8}
                className="font-mono text-sm"
                placeholder='{"deposit_request": "...", "thank_you": "...", "order_to_shop": "...", "ready_pickup": "...", "out_for_delivery": "...", "order_cancelled": "..."}'
              />
            </div>
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
