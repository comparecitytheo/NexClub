import { redirect } from "next/navigation";

// Public registration is disabled — accounts are created by invitation only.
// Any direct visit to /register is redirected to the login page.
export default function RegisterPage() {
  redirect("/login");
}
