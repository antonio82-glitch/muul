import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "w-full bg-transparent border-b border-tinta/20 py-3 px-1 focus:border-turquesa outline-none transition placeholder:text-tinta/30",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";
