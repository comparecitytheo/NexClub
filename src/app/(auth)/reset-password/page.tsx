import { Suspense } from "react";
import { AuthBrandCard } from "@/components/auth/auth-brand-card";
import { ResetPasswordForm } from "./reset-form";

export default function ResetPasswordPage() {
  return (
    <AuthBrandCard
      heading="Reset your password"
      subheading="Choose a new password for your account."
    >
      <Suspense fallback={null}>
        <ResetPasswordForm />
      </Suspense>
    </AuthBrandCard>
  );
}
