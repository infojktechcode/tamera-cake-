"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { updateUserStatus, createManager } from "./actions";

interface UserRowProps {
  user: { id: string; full_name: string; role: string; active: boolean };
}

function UserRow({ user }: UserRowProps) {
  const [loading, setLoading] = useState(false);

  async function handleToggle(status: boolean) {
    setLoading(true);
    try {
      await updateUserStatus(user.id, status);
      toast.success(`User ${user.full_name} ${status ? "activated" : "deactivated"}`);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center justify-between p-3 border-b border-cocoa/5 last:border-0">
      <div className="flex flex-col">
        <span className="font-medium">{user.full_name}</span>
        <span className="text-xs text-ink-muted capitalize">{user.role}</span>
      </div>
      <Button
        variant={user.active ? "outline" : "default"}
        size="sm"
        onClick={() => handleTogle(!user.active)}
        disabled={loading}
      >
        {user.active ? "Deactivate" : "Activate"}
      </Button>
    </div>
  );
}

export function UserManagement() {
  const [showAdd, setShowAdd] = useState(false);

  async function handleAddManager(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    try {
      await createManager(formData);
      toast.success("Manager profile created");
      setShowAdd(false);
      window.location.reload();
    } catch (err: any) {
      toast.error(err.message);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-2xl font-bold">Staff Management</h2>
        <Button onClick={() => setShowAdd(true)}>+ Add Manager</Button>
      </div>

      {showAdd && (
        <Card className="p-6 bg-white border-blush">
          <form onSubmit={handleAddManager} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Full Name</Label>
                <Input name="fullName" required />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input name="email" type="email" required />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
              <Button type="submit">Create Profile</Button>
            </div>
          </form>
        </Card>
      )}

      <Card className="bg-white overflow-hidden border-cocoa/10">
        <div className="divide-y divide-cocoa/5">
          {/* Map users here - passed from server component */}
        </div>
      </Card>
    </div>
  );
}
