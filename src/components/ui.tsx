import { ButtonHTMLAttributes, HTMLAttributes, InputHTMLAttributes, LabelHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { clsx } from "clsx";
import { AlertOctagon, AlertTriangle, Info } from "lucide-react";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={clsx(
        "rounded-2xl border border-gray-200 bg-white p-6 shadow-sm",
        className
      )}
      {...props}
    />
  );
}

export type ButtonVariant = "primary" | "secondary" | "danger" | "ghost" | "outline";
export type ButtonSize = "md" | "sm";

const buttonVariants: Record<ButtonVariant, string> = {
  primary: "bg-blue-600 text-white hover:bg-blue-700",
  secondary: "bg-gray-900 text-white hover:bg-gray-800",
  danger: "bg-red-50 text-red-700 hover:bg-red-100",
  ghost: "bg-transparent text-gray-700 hover:bg-gray-100",
  outline: "border border-gray-200 bg-white text-gray-800 hover:border-gray-300 hover:bg-gray-50",
};

const buttonSizes: Record<ButtonSize, string> = {
  md: "min-h-[44px] px-5 py-2.5 text-sm",
  sm: "min-h-9 px-3.5 py-1.5 text-xs",
};

/** Classes d'un bouton, réutilisables sur un lien (`<Link className={buttonClasses()}>`) : jamais de bouton dans un lien. */
export function buttonClasses({ variant = "primary", size = "md", className }: { variant?: ButtonVariant; size?: ButtonSize; className?: string } = {}) {
  return clsx(
    "inline-flex items-center justify-center gap-2 rounded-full font-medium transition-[background-color,border-color,color,transform] duration-150 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100",
    buttonVariants[variant],
    buttonSizes[size],
    className
  );
}

export function Button({
  className,
  variant = "primary",
  size = "md",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
}) {
  return <button className={buttonClasses({ variant, size, className })} {...props} />;
}

export function Alert({
  variant = "info",
  children,
}: {
  variant?: "success" | "error" | "info";
  children: React.ReactNode;
}) {
  const styles = {
    success: "bg-emerald-50 text-emerald-800 border-emerald-200",
    error: "bg-red-50 text-red-800 border-red-200",
    info: "bg-blue-50 text-blue-800 border-blue-200",
  };
  return (
    <div
      role={variant === "error" ? "alert" : "status"}
      className={clsx("rounded-xl border px-4 py-3 text-sm", styles[variant])}
    >
      {children}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx("animate-pulse rounded-xl bg-gray-200/70", className)} />;
}

export function Avatar({ name, src, className }: { name: string; src?: string | null; className?: string }) {
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element -- photo utilisateur en data URL, pas un asset statique optimisable
    return <img src={src} alt={name} className={clsx("h-10 w-10 shrink-0 rounded-full object-cover", className)} />;
  }
  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase())
    .join("");
  return (
    <div
      className={clsx(
        "flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-600 text-sm font-semibold text-white",
        className
      )}
    >
      {initials || "?"}
    </div>
  );
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={clsx(
        "w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100",
        className
      )}
      {...props}
    />
  );
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={clsx(
        "w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100",
        className
      )}
      {...props}
    />
  );
}

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={clsx(
        "w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100",
        className
      )}
      {...props}
    >
      {children}
    </select>
  );
}

export function Label({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={clsx("mb-1.5 block text-sm font-medium text-gray-700", className)}
      {...props}
    />
  );
}

const badgeStyles: Record<string, string> = {
  gray: "bg-gray-100 text-gray-600",
  blue: "bg-blue-50 text-blue-700",
  green: "bg-emerald-50 text-emerald-700",
  orange: "bg-amber-50 text-amber-700",
  red: "bg-red-50 text-red-700",
};

export function Badge({
  color = "gray",
  children,
}: {
  color?: keyof typeof badgeStyles;
  children: React.ReactNode;
}) {
  return (
    <span
      className={clsx(
        "inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium",
        badgeStyles[color]
      )}
    >
      {children}
    </span>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">{title}</h1>
        {description && <p className="mt-1 max-w-3xl text-pretty text-sm text-gray-500">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-gray-50 py-16 text-center">
      <p className="text-sm text-gray-500">{message}</p>
    </div>
  );
}

export function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-xs text-red-600">{message}</p>;
}

/** Champ avec libellé visible : le libellé ne disparaît pas à la saisie, contrairement à un texte indicatif. */
export function Field({ label, hint, className, children }: { label: string; hint?: string; className?: string; children: React.ReactNode }) {
  return (
    <label className={clsx("block text-sm font-medium text-gray-700", className)}>
      {label}
      <span className="mt-1 block font-normal">{children}</span>
      {hint && <span className="mt-1 block text-xs font-normal text-gray-500">{hint}</span>}
    </label>
  );
}

const noticeStyles = {
  info: { box: "border-blue-200 bg-blue-50 text-blue-900", icon: Info, iconColor: "text-blue-600" },
  warning: { box: "border-amber-200 bg-amber-50 text-amber-900", icon: AlertTriangle, iconColor: "text-amber-600" },
  danger: { box: "border-red-200 bg-red-50 text-red-900", icon: AlertOctagon, iconColor: "text-red-600" },
  neutral: { box: "border-gray-200 bg-gray-50 text-gray-700", icon: Info, iconColor: "text-gray-500" },
} as const;

/** Encadré d'information de page (pas un message de formulaire : voir `Alert`). */
export function Notice({
  tone = "info",
  title,
  children,
  className,
}: {
  tone?: keyof typeof noticeStyles;
  title?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  const s = noticeStyles[tone];
  const Icon = s.icon;
  return (
    <div className={clsx("flex gap-3 rounded-xl border px-4 py-3 text-sm", s.box, className)}>
      <Icon size={18} aria-hidden className={clsx("mt-0.5 shrink-0", s.iconColor)} />
      <div className="min-w-0 flex-1 space-y-1 text-pretty">
        {title && <p className="font-semibold">{title}</p>}
        {children}
      </div>
    </div>
  );
}

/** Titre d'une section de carte, avec description et actions alignées à droite. */
export function SectionTitle({
  title,
  description,
  actions,
  as: Tag = "h2",
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  as?: "h2" | "h3";
}) {
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <Tag className="text-balance text-base font-semibold text-gray-900">{title}</Tag>
        {description && <p className="mt-1 max-w-3xl text-pretty text-xs text-gray-500">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/** Sous-titre à l'intérieur d'une carte. */
export function SubHeading({ children, className }: { children: React.ReactNode; className?: string }) {
  return <h3 className={clsx("text-xs font-semibold uppercase tracking-wide text-gray-500", className)}>{children}</h3>;
}

/** En-tête de tableau commun : contraste suffisant (gris 500, et non 400). */
export const TABLE_HEAD = "border-b border-gray-200 bg-gray-50/80 text-left text-xs font-semibold uppercase tracking-wide text-gray-500";
