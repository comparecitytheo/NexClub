import { SignInCard } from "../sign-in-card";

// Auth.js redirects here via `pages.signIn`. The site root renders the same card.
export default function LoginPage() {
  return <SignInCard />;
}
