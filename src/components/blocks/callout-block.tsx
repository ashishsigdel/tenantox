import { DynamicIcon } from "@/lib/icons";
import { cn } from "@/lib/utils";
import type { CalloutConfig } from "@/types/meta";

const TONE: Record<CalloutConfig["tone"], { box: string; defaultIcon: string }> = {
  info: { box: "border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-900/50 dark:bg-blue-950/40 dark:text-blue-200", defaultIcon: "Info" },
  success: { box: "border-green-200 bg-green-50 text-green-900 dark:border-green-900/50 dark:bg-green-950/40 dark:text-green-200", defaultIcon: "CircleCheck" },
  warning: { box: "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200", defaultIcon: "TriangleAlert" },
  danger: { box: "border-red-200 bg-red-50 text-red-900 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200", defaultIcon: "OctagonAlert" },
};

export function CalloutBlock({ config }: { config: CalloutConfig }) {
  const tone = TONE[config.tone] ?? TONE.info;
  return (
    <div className={cn("flex gap-3 rounded-lg border p-4 text-sm", tone.box)}>
      <DynamicIcon
        name={config.icon || tone.defaultIcon}
        className="mt-0.5 size-4 shrink-0"
      />
      <p>{config.text}</p>
    </div>
  );
}
