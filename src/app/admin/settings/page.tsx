import { getSettings } from "./actions";
import { SettingsForm } from "@/components/admin/SettingsForm";

export default async function SettingsPage() {
  const settings = await getSettings();

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold">Shop Settings</h1>
        <p className="text-ink-muted">Configure business rules and contact details.</p>
      </div>
      <SettingsForm initialSettings={settings} />
    </div>
  );
}
