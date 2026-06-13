import { redirect } from "next/navigation";

export default function InterceptedSettingsIndex() {
  redirect("/dashboard/settings/account");
}
