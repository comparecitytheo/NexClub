import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { initials } from "@/lib/format";
import { cn } from "@/lib/utils";

type Props = {
  userId: string;
  name?: string | null;
  avatarUrl?: string | null;
  className?: string;
};

// Drop-in avatar for anywhere a member appears. Falls back to initials when
// the member has no picture (or storage isn't configured).
export function MemberAvatar({ name, avatarUrl, className }: Props) {
  return (
    <Avatar className={cn("h-9 w-9", className)}>
      {avatarUrl ? <AvatarImage src={avatarUrl} alt={name ?? ""} /> : null}
      <AvatarFallback>{initials(name)}</AvatarFallback>
    </Avatar>
  );
}
