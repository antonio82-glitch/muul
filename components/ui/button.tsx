import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center font-mono text-xs uppercase tracking-[0.2em] transition disabled:opacity-40 disabled:pointer-events-none rounded-sm",
  {
    variants: {
      variant: {
        primary: "bg-tinta text-hueso hover:bg-tinta-2",
        secondary: "bg-turquesa text-tinta hover:bg-turquesa-deep hover:text-hueso",
        accent: "bg-coral text-hueso hover:opacity-90",
        outline: "border border-tinta/20 hover:border-coral hover:text-coral",
        ghost: "hover:bg-hueso-2",
      },
      size: {
        sm: "h-9 px-4",
        md: "h-12 px-8",
        lg: "h-14 px-10",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp ref={ref} className={cn(buttonVariants({ variant, size, className }))} {...props} />;
  },
);
Button.displayName = "Button";
