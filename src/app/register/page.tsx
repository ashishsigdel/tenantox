import { Suspense } from "react";
import type { Metadata } from "next";
import Image from "next/image";
import { LayoutDashboard } from "lucide-react";
import { RegisterForm } from "./register-form";

export const metadata: Metadata = {
  title: "Create your account",
};

export default function RegisterPage() {
  return (
    <div className="grid min-h-svh lg:grid-cols-[45fr_55fr]">
      {/* Left — form column */}
      <div className="flex flex-col px-6 py-8 sm:px-10 lg:px-16">
        <div className="flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <LayoutDashboard className="size-4" />
          </div>
          <span className="text-sm font-semibold tracking-tight">
            Tenantox
          </span>
        </div>

        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-12">
          <h1 className="text-3xl leading-[1.15] font-semibold tracking-tight text-balance sm:text-[2.1rem]">
            Create your account
            <br />
            and your first workspace.
          </h1>

          <div className="mt-8">
            <Suspense>
              <RegisterForm />
            </Suspense>
          </div>
        </div>

        <p className="mx-auto w-full max-w-sm text-xs leading-relaxed text-muted-foreground">
          By creating an account you agree to our{" "}
          <a href="#" className="text-foreground underline-offset-4 hover:underline">
            Terms
          </a>{" "}
          and{" "}
          <a href="#" className="text-foreground underline-offset-4 hover:underline">
            Privacy Policy
          </a>
          .
        </p>
      </div>

      {/* Right — hero image */}
      <div className="relative hidden flex-col lg:flex">
        <div className="relative flex-1 overflow-hidden">
          <Image
            src="/images/login-page-art.png"
            alt=""
            fill
            priority
            sizes="55vw"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-linear-to-t from-black/50 via-black/10 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 p-12 text-white">
            <blockquote className="max-w-md space-y-3">
              <p className="text-xl leading-snug font-medium text-balance">
                Spin up an admin panel for any API in minutes — your workspace,
                your rules.
              </p>
              <footer className="text-sm text-white/70">
                Schema-driven admin, ready in minutes.
              </footer>
            </blockquote>
          </div>
        </div>
      </div>
    </div>
  );
}
