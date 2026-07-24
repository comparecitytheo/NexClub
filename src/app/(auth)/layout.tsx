import { Logo } from "@/components/shared/logo";
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <Logo size="h-8" />
        </div>
        {children}
      </div>
    </div>
  );
}
