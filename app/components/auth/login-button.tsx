import { MessageCircle } from "lucide-react";
import { useAuth } from "~/hooks/use-auth";
import { cn } from "~/lib/utils";

export function LoginButton({ className }: { className?: string }) {
  const { signInWithKakao } = useAuth();

  return (
    <button
      type="button"
      onClick={signInWithKakao}
      className={cn(
        "optical-center inline-flex h-8 items-center gap-1.5 rounded-full bg-[#FEE500] px-3 text-xs font-semibold text-[#191919] transition-opacity hover:opacity-90",
        className,
      )}
    >
      <MessageCircle className="h-3.5 w-3.5 fill-[#191919]" />
      카카오 로그인
    </button>
  );
}
