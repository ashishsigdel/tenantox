"use client";

import { Monitor, Moon, Sun } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useTheme } from "@/components/theme";

const THEMES = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
] as const;

export default function AppearancePage() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Appearance</h2>
        <p className="text-sm text-muted-foreground">
          Customize how the dashboard looks on this device.
        </p>
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Theme</CardTitle>
          <CardDescription>
            Select a theme. &ldquo;System&rdquo; follows your OS setting.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RadioGroup
            value={theme}
            onValueChange={(v) => setTheme(v as typeof theme)}
            className="grid gap-3 sm:grid-cols-3"
          >
            {THEMES.map((option) => (
              <Label
                key={option.value}
                htmlFor={`theme-${option.value}`}
                className="flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-accent has-[:checked]:border-primary has-[:checked]:bg-accent"
              >
                <RadioGroupItem
                  id={`theme-${option.value}`}
                  value={option.value}
                />
                <option.icon className="size-4" />
                <span className="text-sm font-medium">{option.label}</span>
              </Label>
            ))}
          </RadioGroup>
        </CardContent>
      </Card>
    </div>
  );
}
