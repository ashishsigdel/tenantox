import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export const metadata = { title: "Notifications" };

const PREFERENCES = [
  {
    id: "product-updates",
    label: "Product updates",
    description: "News about new features and improvements.",
  },
  {
    id: "activity-digest",
    label: "Activity digest",
    description: "A weekly summary of changes in your dashboard.",
  },
  {
    id: "security-alerts",
    label: "Security alerts",
    description: "Important notices about your account security.",
  },
];

export default function NotificationsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <h2 className="text-xl font-semibold">Notifications</h2>
        <Badge variant="secondary">Coming soon</Badge>
      </div>
      <p className="text-sm text-muted-foreground">
        Choose what you&apos;re notified about. Saving preferences isn&apos;t
        available yet.
      </p>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Email notifications</CardTitle>
          <CardDescription>
            These controls are a preview and don&apos;t persist yet.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {PREFERENCES.map((pref) => (
            <div
              key={pref.id}
              className="flex items-center justify-between gap-4"
            >
              <div className="space-y-0.5">
                <Label className="text-sm font-medium">{pref.label}</Label>
                <p className="text-sm text-muted-foreground">
                  {pref.description}
                </p>
              </div>
              <Switch disabled aria-label={pref.label} />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
