import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { SignInCard } from "./sign-in-card";

// The club portal has no public marketing page. This lives in the (auth) route
// group — which doesn't affect the URL — so the site root renders the sign-in
// screen inside the shared auth shell, with no redirect to /login.
export default async function Home() {
  const session = await auth();
  if (session?.user) redirect("/dashboard");
  return <SignInCard />;
}
