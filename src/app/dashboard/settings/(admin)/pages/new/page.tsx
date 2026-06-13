import { PageSettingsForm } from "@/components/builder/page-settings-form";
import type { PageInput } from "@/server/actions/pages";

export const metadata = { title: "New Page" };

const DEFAULT_INPUT: PageInput = {
  name: "",
  slug: "",
  icon: "",
  description: "",
  viewRole: "VIEWER",
};

export default function NewPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">New Page</h1>
        <p className="text-sm text-muted-foreground">
          Step 1 of 2: name the page, then add blocks.
        </p>
      </div>
      <PageSettingsForm initial={DEFAULT_INPUT} isNew />
    </div>
  );
}
