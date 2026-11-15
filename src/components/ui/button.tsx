import { Loader2 } from "lucide-react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/ui/format";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "subtle" | "danger";
export type ButtonSize = "xs" | "sm" | "md" | "lg" | "icon";

const variantClasses: Record<ButtonVariant, string> = {
  primary: "bg-accent text-accent-fg hover:opacity-90",
  secondary: "border border-line bg-canvas text-primary hover:bg-hover",
  ghost: "text-secondary hover:bg-hover hover:text-primary",
  subtle: "border border-line bg-surface text-primary hover:bg-hover",
  danger:
    "border border-red-300 text-red-700 hover:bg-red-50 dark:border-red-900/70 dark:text-red-400 dark:hover:bg-red-950/40",
};

const sizeClasses: Record<ButtonSize, string> = {
  xs: "h-7 gap-1.5 rounded px-2 text-xs",
  sm: "h-8 gap-1.5 rounded-md px-3 text-xs",
  md: "h-9 gap-2 rounded-md px-4 text-sm",
  lg: "h-11 gap-2 rounded-md px-5 text-sm",
  icon: "h-8 w-8 rounded-md",
};

export function buttonVariants({
  variant = "primary",
  size = "md",
  className,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
} = {}): string {
  return cn(
    "inline-flex shrink-0 items-center justify-center font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas disabled:pointer-events-none disabled:opacity-50",
    variantClasses[variant],
    sizeClasses[size],
    className,
  );
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  children?: ReactNode;
};

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  className,
  disabled,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={buttonVariants({ variant, size, className })}
      disabled={disabled || loading}
      type={props.type ?? "button"}
      {...props}
    >
      {loading ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : null}
      {children}
    </button>
  );
}