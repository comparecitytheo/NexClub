"use client";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { LogOut, Settings } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type Props = {
  name?: string | null;
  /** Shown between the name and the email, so the account is identifiable at a glance. */
  businessName?: string | null;
  email?: string | null;
  image?: string | null;
};

export function UserMenu({ name, businessName, email, image }: Props) {
  const initials = (name ?? email ?? "U")
    .split(" ")
    // Whole character, not one UTF-16 unit — see initials() in lib/format.
    .map((s) => [...s][0] ?? "")
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="rounded-full outline-none ring-offset-2 focus-visible:ring-1 focus-visible:ring-ring">
        <Avatar>
          <AvatarImage src={image ?? undefined} alt={name ?? ""} />
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <div className="font-medium">{name}</div>
          {businessName ? (
            <div className="truncate text-xs font-normal text-muted-foreground">{businessName}</div>
          ) : null}
          <div className="truncate text-xs font-normal text-muted-foreground">{email}</div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild className="cursor-pointer">
          <Link href="/settings">
            <Settings /> Profile settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="cursor-pointer text-destructive focus:text-destructive"
        >
          <LogOut /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
