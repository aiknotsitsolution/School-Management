// Shared, small UI primitives used across module pages.

import { useState } from "react";

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

export function PageIntro({ eyebrow, title, description, right }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-5">
      <div>
        {eyebrow && <p className="text-[12.5px] font-semibold text-amber-dark mb-1">{eyebrow}</p>}
        <h2 className="font-display text-2xl font-bold text-ink">{title}</h2>
        {description && <p className="text-slate-text text-[13.5px] mt-1 max-w-xl">{description}</p>}
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

export function Input({ className = "", ...props }) {
  return (
    <input
      className={`px-3.5 py-2.5 rounded-lg border border-black/10 text-[13px] outline-none focus:border-ink/40 bg-white placeholder:text-slate-text/50 ${className}`}
      {...props}
    />
  );
}

export function Select({ className = "", children, ...props }) {
  return (
    <select
      className={`px-3.5 py-2.5 rounded-lg border border-black/10 text-[13px] outline-none focus:border-ink/40 bg-white ${className}`}
      {...props}
    >
      {children}
    </select>
  );
}

// Lightweight toast/toaster helpers -------------------------------------------
export function toast(message, tone = "success") {
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
    setTimeout(() => el.remove(), 300);
  }, 3200);
}
