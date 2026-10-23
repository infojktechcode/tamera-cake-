"use client";

import { useState, useEffect } from "react";
import { format, addDays, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { toggleDateBlock, unblockDate } from "@/app/admin/calendar/actions";

interface CalendarProps {
  initialData: {
    blockedDates: string[];
    dailyOrders: Record<string, number>;
    dailyLimit: number;
  };
}

export function AdminCalendar({ initialData }: CalendarProps) {
  const [data, setData] = useState(initialData);
  const [currentDate, setCurrentDate] = useState(new Date());

  const daysInMonth = eachDayOfInterval({
    start: startOfMonth(currentDate),
    end: endOfMonth(currentDate),
  });

  async function handleToggleBlock(date: string, isBlocked: boolean) {
    try {
      if (isBlocked) {
        const reason = prompt("Reason for blocking this date?");
        if (!reason) return;
        await toggleDateBlock(date, reason);
      } else {
        await unblockDate(date);
      }
      toast.success("Calendar updated");
      // Refresh data - in a real app we'd call a refetch function
      window.location.reload();
    } catch (err: any) {
      toast.error(err.message);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-2xl font-bold">Production Calendar</h2>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setCurrentDate(addDays(currentDate, -30))}>← Prev</Button>
          <Button variant="outline" onClick={() => setCurrentDate(addDays(currentDate, 30))}>Next →</Button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-2">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(d => (
          <div key={d} className="text-center text-xs font-bold text-ink-muted uppercase">{d}</div>
        ))}
        {daysInMonth.map((day, i) => {
          const dateStr = format(day, "yyyy-MM-dd");
          const isBlocked = data.blockedDates.includes(dateStr);
          const orderCount = data.dailyOrders[dateStr] || 0;
          const isFull = orderCount >= data.dailyLimit;

          return (
            <Card
              key={i}
              className={`relative h-24 p-2 transition-all cursor-pointer hover:ring-2 ring-blush ${
                isBlocked ? "bg-red-50 border-red-200" :
                isFull ? "bg-amber-50 border-amber-200" : "bg-white"
              }`}
              onClick={() => handleToggleBlock(dateStr, isBlocked)}
            >
              <span className="text-sm font-medium">{format(day, "d")}</span>

              <div className="mt-1 flex flex-col gap-1">
                {orderCount > 0 && (
                  <div className="flex items-center gap-1 text-[10px] font-bold text-cocoa">
                    <span className="h-1.5 w-1.5 rounded-full bg-blush" />
                    {orderCount} Cake{orderCount > 1 ? 's' : ''}
                  </div>
                )}
                {isBlocked && <span className="text-[10px] text-red-500 font-bold">BLOCKED</span>}
                {isFull && !isBlocked && <span className="text-[10px] text-amber-600 font-bold">FULL</span>}
              </div>
            </Card>
          );
        })}
      </div>

      <div className="flex gap-4 text-xs text-ink-muted">
        <div className="flex items-center gap-1">
          <div className="h-3 w-3 bg-white border border-cocoa/20" /> Open
        </div>
        <div className="flex items-center gap-1">
          <div className="h-3 w-3 bg-amber-50 border border-amber-200" /> Full ({data.dailyLimit}/day)
        </div>
        <div className="flex items-center gap-1">
          <div className="h-3 w-3 bg-red-50 border border-red-200" /> Blocked
        </div>
      </div>
    </div>
  );
}
