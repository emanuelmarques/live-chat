import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "danger" | "dark";

export function Button({
  variant = "primary",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return <button {...props} className={`btn btn--${variant}${className ? ` ${className}` : ""}`} />;
}
