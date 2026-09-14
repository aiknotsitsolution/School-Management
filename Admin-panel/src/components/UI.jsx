// Shared, small UI primitives used across module pages.

import { Children, useEffect, useRef, useState } from "react";
import { ChevronDown, Eye, EyeOff } from "lucide-react";

export function StatCard({ icon: Icon, label, value, sub, accent = "amber" }) {
  const accents = {
    amber: "border-amber text-amber bg-amber/10",
    success: "border-success text-success bg-success/10",
    info: "border-info text-info bg-info/10",
    alert: "border-alert text-alert bg-alert/10",
  };
  const tone = accents[accent] || accents.amber;
  return (
    <div className={`bg-white rounded-2xl p-5 border-l-4 ${tone.split(" ")[0]} shadow-sm`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[12.5px] text-slate-text/80 font-medium">{label}</p>
          <p className="font-display text-[28px] font-bold text-ink mt-1 leading-none">{value}</p>
          {sub && <p className="text-[11.5px] text-slate-text/60 mt-2">{sub}</p>}
        </div>
        {Icon && (
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${tone.split(" ").slice(1).join(" ")}`}>
            <Icon size={19} />
          </div>
        )}
      </div>
    </div>
  );
}

export function Card({ title, action, children, className = "", bodyClassName = "p-5" }) {
  return (
    <div className={`bg-white rounded-2xl border border-black/[0.06] shadow-sm ${className}`}>
      {title && (
        <div className="flex items-center justify-between px-5 py-4 border-b border-black/[0.06]">
          <h3 className="font-display font-semibold text-ink text-[15px]">{title}</h3>
          {action}
        </div>
      )}
      <div className={bodyClassName}>{children}</div>
    </div>
  );
}

export function Pill({ children, tone = "neutral" }) {
  const tones = {
    neutral: "bg-slate-100 text-slate-600",
    success: "bg-success/10 text-success",
    alert: "bg-alert/10 text-alert",
    amber: "bg-amber/15 text-amber-dark",
    info: "bg-info/10 text-info",
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11.5px] font-semibold whitespace-nowrap ${tones[tone]}`}>
      {children}
    </span>
  );
}

export function statusTone(status) {
  const map = {
    Paid: "success", Success: "success", Submitted: "success", Graded: "success",
    "Admission Confirmed": "success", "On Route": "success", Present: "success",
    Pending: "amber", "Partially Paid": "amber", "Pending Clearance": "amber",
    New: "info", Contacted: "info", "Campus Visit Scheduled": "info", "Not Started": "info",
    Overdue: "alert", Declined: "alert", Absent: "alert", Delayed: "alert",
  };
  return map[status] || "neutral";
}

export function Avatar({ src, name, size = 32, className = "" }) {
  const [broken, setBroken] = useState(false);
  const usable = src && !broken;
  if (!usable) {
    const initials = String(name || "?")
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0].toUpperCase())
      .join("");
    return (
      <div
        role="img"
        aria-label={name}
        style={{ width: size, height: size, fontSize: Math.round(size * 0.4) }}
        className={`rounded-full bg-amber/25 text-amber-dark font-display font-bold flex items-center justify-center shrink-0 ${className}`}
      >
        {initials}
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={name}
      onError={() => setBroken(true)}
      style={{ width: size, height: size }}
      className={`rounded-full object-cover shrink-0 ${className}`}
    />
  );
}

export function PageIntro({ eyebrow, title, description, descriptionClassName = "max-w-xl", right }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-5">
      <div>
        {eyebrow && <p className="text-[12.5px] font-semibold text-amber-dark mb-1">{eyebrow}</p>}
        <h2 className="font-display text-2xl font-bold text-ink">{title}</h2>
        {description && <p className={`text-slate-text text-[13.5px] mt-1 ${descriptionClassName}`}>{description}</p>}
      </div>
      {right}
    </div>
  );
}

export function Button({ children, variant = "primary", className = "", ...props }) {
  const variants = {
    primary: "bg-ink text-white hover:bg-ink-light",
    amber: "bg-amber text-ink hover:bg-amber-dark",
    outline: "bg-white text-ink border border-black/10 hover:bg-paper",
    ghost: "text-ink hover:bg-black/5",
  };
  return (
    <button
      className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-[13px] font-semibold transition-colors ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function Input({ className = "", type = "text", wrapperClassName = "", ...props }) {
  const [show, setShow] = useState(false);
  const isPassword = type === "password";
  const visibleType = isPassword ? (show ? "text" : "password") : type;
  if (!isPassword) {
    return (
      <input
        type={visibleType}
        className={`w-full px-4 py-2.5 rounded-xl border border-black/10 bg-white text-[13.5px] text-ink outline-none transition-all placeholder:text-slate-text/40 hover:border-black/20 focus:border-amber focus:ring-4 focus:ring-amber/15 ${className}`}
        {...props}
      />
    );
  }
  return (
    <div className={`relative w-full ${wrapperClassName}`}>
      <input
        type={visibleType}
        className={`w-full pl-4 pr-10 py-2.5 rounded-xl border border-black/10 bg-white text-[13.5px] text-ink outline-none transition-all placeholder:text-slate-text/40 hover:border-black/20 focus:border-amber focus:ring-4 focus:ring-amber/15 ${className}`}
        {...props}
      />
      <button
        type="button"
        tabIndex={-1}
        aria-label={show ? "Hide password" : "Show password"}
        onClick={() => setShow((v) => !v)}
        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-text/40 hover:text-slate-text/75 transition-colors"
      >
        {show ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
}

export function PasswordInput({ icon: Icon, className = "", ...props }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      {Icon && <Icon size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-text/40" />}
      <input
        type={show ? "text" : "password"}
        className={`w-full pl-10 pr-10 py-3 rounded-lg border border-black/10 text-[13.5px] outline-none focus:border-ink/40 bg-white ${className}`}
        {...props}
      />
      <button
        type="button"
        tabIndex={-1}
        aria-label={show ? "Hide password" : "Show password"}
        onClick={() => setShow((v) => !v)}
        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-text/40 hover:text-slate-text/75 transition-colors"
      >
        {show ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
}

export function Select({
  className = "",
  children,
  value,
  defaultValue,
  onChange,
  name,
  id,
  required,
  disabled,
  onClick,
  size = "md",
  borderless = false,
  ...rest
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(defaultValue ?? "");
  const rootRef = useRef(null);
  const hiddenRef = useRef(null);

  const isControlled = value !== undefined;
  const current = isControlled ? value ?? "" : draft;
  const hasWidth = /\bw-/.test(className || "");

  const options = Children.toArray(children)
    .filter((child) => child && child.props && child.props.value !== undefined)
    .map((child) => ({
      value: String(child.props.value),
      label: child.props.children,
      disabled: Boolean(child.props.disabled),
      placeholder: String(child.props.value) === "",
    }));

  const selected =
    options.find((option) => String(option.value) === String(current)) || null;
  const shown = selected ? selected.label : rest.placeholder || "Select";

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const commit = (option) => {
    if (option.disabled) return;
    const next = String(option.value);
    if (!isControlled) {
      setDraft(next);
      if (hiddenRef.current) hiddenRef.current.value = next;
    }
    setOpen(false);
    onChange?.({ target: { value: next, name } });
  };

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      {/* Hidden native select keeps form/FormData submission working. */}
      <select
        ref={hiddenRef}
        name={name}
        id={id}
        required={required}
        disabled={disabled}
        tabIndex={-1}
        aria-hidden="true"
        className="sr-only"
        value={current}
        onChange={(e) => commit({ value: e.target.value, disabled: false })}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </option>
        ))}
      </select>

      <button
        type="button"
        disabled={disabled}
        onClick={(e) => {
          onClick?.(e);
          if (!disabled) setOpen((prev) => !prev);
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
        {...rest}
        className={`flex items-center justify-between gap-2 rounded-xl bg-white text-left outline-none transition-all ${
          borderless ? "border-0" : "border"
        } ${
          size === "sm" ? "px-2 py-1 rounded-lg text-[12px]" : "px-3 py-2.5 text-[13px]"
        } ${hasWidth ? "" : "w-full"} ${className} ${
          disabled
            ? "cursor-not-allowed bg-slate-50 opacity-50"
            : open
              ? borderless
                ? "bg-paper"
                : "border-amber ring-4 ring-amber/15"
              : borderless
                ? "hover:bg-paper"
                : "border-black/10 hover:border-black/20"
        }`}
      >
        <span
          className={`truncate ${selected ? "text-ink" : "text-slate-text/60"}`}
        >
          {shown}
        </span>
        <ChevronDown
          size={15}
          className={`shrink-0 text-slate-text/50 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute left-0 top-full z-40 mt-1.5 w-full overflow-hidden rounded-xl border border-black/10 bg-white shadow-lg shadow-black/5"
        >
          <div className="max-h-72 overflow-y-auto p-1">
            {options.map((option) => {
              const active = String(option.value) === String(current);
              return (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={active}
                  disabled={option.disabled}
                  onClick={() => commit(option)}
                  className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-[13px] transition-colors ${
                    active
                      ? "bg-amber/10 font-semibold text-ink"
                      : option.disabled
                        ? "cursor-not-allowed text-slate-text/40"
                        : "text-slate-text hover:bg-paper hover:text-ink"
                  }`}
                >
                  <span
                    className={`truncate ${option.placeholder && !active ? "text-slate-text/60" : ""}`}
                  >
                    {option.label}
                  </span>
                  {active && (
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-dark" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// Lightweight toast/toaster helpers -------------------------------------------
const _activeToasts = new Set();
export function toast(message, tone = "success") {
  if (_activeToasts.has(message)) return;
  _activeToasts.add(message);
  const tones = {
    success: { bg: "#3F8F5F", icon: "✓" },
    error: { bg: "#D65A4A", icon: "✕" },
    info: { bg: "#3B6FA0", icon: "ℹ" },
    amber: { bg: "#C9832A", icon: "!" },
  };
  const t = tones[tone] || tones.success;
  const el = document.createElement("div");
  el.className = "toast-item";
  el.style.setProperty("--toast-bg", t.bg);
  el.innerHTML = `<span class="toast-icon">${t.icon}</span><span class="toast-msg"></span>`;
  el.querySelector(".toast-msg").textContent = message;
  const container =
    document.querySelector(".toast-container") ||
    (() => {
      const c = document.createElement("div");
      c.className = "toast-container";
      document.body.appendChild(c);
      return c;
    })();
  container.appendChild(el);
  requestAnimationFrame(() => el.classList.add("toast-visible"));
  setTimeout(() => {
    el.classList.remove("toast-visible");
    setTimeout(() => {
      el.remove();
      _activeToasts.delete(message);
    }, 300);
  }, 3200);
}
