import { Suspense } from "react";
import type { Metadata } from "next";
import Image from "next/image";
import { LayoutDashboard } from "lucide-react";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Sign in",
};

const TRUSTED_BY = ["Acme", "Globex", "Initech", "Umbra", "Hooli", "Stark"];

export default function LoginPage() {
  return (
    <div className="grid min-h-svh lg:grid-cols-[45fr_55fr]">
      {/* Left — form column on the cream canvas */}
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
            Welcome back.
            <br />
            Log in to your account below.
          </h1>

          <div className="mt-8">
            <Suspense>
              <LoginForm />
            </Suspense>
          </div>
        </div>

        <p className="mx-auto w-full max-w-sm text-xs leading-relaxed text-muted-foreground">
          By signing in you acknowledge that we collect and use your information
          as described in our{" "}
          <a
            href="#"
            className="text-foreground underline-offset-4 hover:underline"
          >
            Privacy Policy
          </a>
          .
        </p>
      </div>

      {/* Right — hero image + trusted-by strip (hidden on small screens) */}
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
                Build internal tools your team actually wants to use — every
                resource, one calm surface.
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
