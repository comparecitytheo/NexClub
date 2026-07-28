import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LoginForm } from "./login/login-form";

// Rendered by both `/` and `/login` so the site root is the sign-in screen
// without a redirect hop, while /login stays available as Auth.js's signIn page.
export function SignInCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Sign in</CardTitle>
        <CardDescription>Welcome back to the club.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <LoginForm />
      </CardContent>
    </Card>
  );
}
