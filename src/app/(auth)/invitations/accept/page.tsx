import { Suspense } from "react";
import { AuthBrandCard } from "@/components/auth/auth-brand-card";
import { AcceptInvitationForm } from "@/components/invitations/accept-invitation";

export default function AcceptInvitationPage() {
  return (
    <AuthBrandCard
      heading="Set up your account"
      subheading="Confirm your details and choose a password to activate your membership."
    >
      <Suspense fallback={null}>
        <AcceptInvitationForm />
      </Suspense>
    </AuthBrandCard>
  );
}
