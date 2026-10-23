"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { toast } from "sonner";
import { getSupabaseUrl, getSupabasePublishableKey } from "@/lib/supabase/env";

export function OrderNotifications() {
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [newOrderCount, setNewOrderCount] = useState(0);

  useEffect(() => {
    // 1. Initialize Supabase Client for Realtime
    const supabase = createClient(
      getSupabaseUrl(),
      getSupabasePublishableKey()
    );

    // 2. Sound effect for new orders
    const audio = new Audio("https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3");
    audio.volume = 0.5;

    // 3. Subscribe to NEW orders only
    const channel = supabase
      .channel("admin-orders")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "orders",
        },
        (payload) => {
          console.log("🔔 New order received!", payload);

          // Visual notification
          toast.success("New Order Received!", {
            description: `Order ${payload.new.order_no} has just arrived.`,
            action: {
              label: "View",
              onClick: () => {
                window.location.href = `/admin/orders`;
              },
            },
          });

          // Audio notification
          if (soundEnabled) {
            audio.play().catch((e) => console.error("Audio playback failed:", e));
          } else {
            console.log("Sound is disabled; skipping audio.");
          }

          // Increment badge count
          setNewOrderCount((prev) => prev + 1);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [soundEnabled]);

  return (
    <div className="fixed bottom-20 right-4 z-50 flex items-center gap-2 rounded-full bg-white p-1 shadow-lg border border-cocoa/10 lg:bottom-8">
      <button
        onClick={() => setSoundEnabled(!soundEnabled)}
        className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
          soundEnabled
            ? "bg-blush text-white"
            : "bg-vanilla text-cocoa/60 hover:bg-vanilla/80"
        }`}
      >
        <span>{soundEnabled ? "🔊 Sound On" : "🔇 Sound Off"}</span>
      </button>

      {newOrderCount > 0 && (
        <div className="flex items-center gap-1 rounded-full bg-cocoa text-white px-2 py-1 text-[10px] font-bold animate-bounce">
          <span>{newOrderCount} New</span>
        </div>
      )}
    </div>
  );
}
