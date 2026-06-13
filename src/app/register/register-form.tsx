"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Eye, EyeOff, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { registerUser } from "@/server/actions/auth";

export function RegisterForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const form = new FormData(e.currentTarget);
    const email = String(form.get("email"));
    const password = String(form.get("password"));

    const result = await registerUser({
      name: String(form.get("name")),
      email,
      password,
      workspaceName: String(form.get("workspaceName") || ""),
    });

    if (!result.ok) {
      setError(result.error);
      setLoading(false);
      return;
    }

    const signin = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
    if (signin?.error) {
      // Account created but auto sign-in failed — send them to login.
      router.push("/login");
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="name" className="text-xs font-medium text-muted-foreground">
          Full name
        </Label>
        <Input
          id="name"
          name="name"
          type="text"
          placeholder="Ada Lovelace"
          autoComplete="name"
          required
          className="h-11 px-3.5 text-sm"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="workspaceName" className="text-xs font-medium text-muted-foreground">
          Workspace name <span className="text-muted-foreground/60">(optional)</span>
        </Label>
        <Input
          id="workspaceName"
          name="workspaceName"
          type="text"
          placeholder="Acme Inc."
          className="h-11 px-3.5 text-sm"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="email" className="text-xs font-medium text-muted-foreground">
          Email
        </Label>
        <Input
          id="email"
          name="email"
          type="email"
          placeholder="name@company.com"
          autoComplete="email"
          required
          className="h-11 px-3.5 text-sm"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="password" className="text-xs font-medium text-muted-foreground">
          Password
        </Label>
        <div className="relative">
          <Input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            placeholder="At least 8 characters"
            autoComplete="new-password"
            required
            minLength={8}
            className="h-11 px-3.5 pr-10 text-sm"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            tabIndex={-1}
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
      </div>
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
      <Button
        type="submit"
        disabled={loading}
        className="h-11 w-full rounded-xl text-sm"
      >
        {loading && <Loader2 className="size-4 animate-spin" />}
        Create account
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <a
          href="/login"
          className="font-medium text-foreground underline-offset-4 hover:underline"
        >
          Sign in
        </a>
      </p>
    </form>
  );
}
