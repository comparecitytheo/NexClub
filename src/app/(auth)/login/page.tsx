import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LoginForm } from "./login-form";

export default function LoginPage() {
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
