import { Settings } from "lucide-react";

export default function AdminSettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Console configuration and preferences.</p>
      </div>

      <div className="rounded-lg border border-border bg-card p-8 text-center space-y-3">
        <Settings className="mx-auto h-10 w-10 text-muted-foreground" />
        <h3 className="text-lg font-semibold text-card-foreground">Settings coming soon</h3>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          Console settings, notification preferences, access control, and integration configuration will be available here.
        </p>
      </div>
    </div>
  );
}
