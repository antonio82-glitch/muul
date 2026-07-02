import { cn } from "@/lib/utils";

export function Wordmark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "font-display font-light leading-none tracking-display text-3xl",
        className,
      )}
    >
      M<span className="text-coral">ú</span>ul
    </span>
  );
}
