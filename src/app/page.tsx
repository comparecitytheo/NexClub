import Link from "next/link";
import { Logo } from "@/components/shared/logo";

// Placeholder landing page. The authenticated app shell, auth routes, and
// dashboards arrive in Phase 2.
export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 text-center">
      <div className="space-y-3">
        <Logo size="h-10" />
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          Lead sharing for the club
        </h1>
        <p className="mx-auto max-w-md text-muted-foreground">
          Members send leads to each other and track them through the pipeline.
          Authentication and dashboards land in Phase 2.
        </p>
      </div>
      <div className="flex gap-3">
        <Link
          href="/login"
          className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition hover:opacity-90"
        >
          Sign in
        </Link>
      </div>
    </main>
  );
}
