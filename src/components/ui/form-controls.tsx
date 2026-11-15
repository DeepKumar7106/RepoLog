import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/ui/format";

export const inputClass = cn(
  "h-9 w-full rounded-md border border-line bg-canvas px-3 text-sm text-primary shadow-none transition-colors",
  "placeholder:text-muted focus:border-line-strong focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/20",
  "disabled:cursor-not-allowed disabled:opacity-60",
);

export const selectClass = cn(
  "h-9 w-full appearance-none rounded-md border border-line bg-canvas px-3 pr-8 text-sm text-primary shadow-none transition-colors",
  "focus:border-line-strong focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/20",
  "disabled:cursor-not-allowed disabled:opacity-60",
);

export const textareaClass = cn(
  "min-h-24 w-full rounded-md border border-line bg-canvas px-3 py-2 text-sm text-primary shadow-none transition-colors",
  "placeholder:text-muted focus:border-line-strong focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/20",
);

export function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
  className,
}: Readonly<{
  label: string;
  htmlFor?: string;
  hint?: ReactNode;
  error?: string | null;
  children: ReactNode;
  className?: string;
}>) {
  return (
    <div className={className}>
      <label className="mb-1.5 block text-xs font-medium text-primary" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {error ? (
        <p className="mt-1.5 text-xs text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="mt-1.5 text-xs text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(inputClass, className)} {...props} />;
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(textareaClass, className)} {...props} />;
}

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn(selectClass, className)} {...props} />;
}