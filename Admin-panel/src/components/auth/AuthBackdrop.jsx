import {
  GraduationCap,
  BookOpen,
  School,
  Blocks,
  Zap,
  Network,
  ChartColumn,
  LayoutDashboard,
  UserRound,
  ClipboardList,
  Bell,
  Award,
  Pencil,
  Orbit,
  Cloud,
  Sparkles,
} from "lucide-react";

const FLOAT_VARIANTS = ["auth-float-a", "auth-float-b", "auth-float-c", "auth-float-d"];
const FLOAT_DURATION = [14, 10, 17, 12];
const FLOAT_DELAY = [0, 1.4, 2.7, 0.7, 3.4, 1.9, 4.2, 0.3];

const PLACED = (C, style, i = 0, extra = {}) => (
  <C
    key={i}
    aria-hidden="true"
    strokeWidth={1.4}
    style={{
      position: "absolute",
      animation: `${FLOAT_VARIANTS[i % 4]} ${FLOAT_DURATION[i % 4]}s ease-in-out ${FLOAT_DELAY[i % 8]}s infinite`,
      willChange: "transform",
      ...style,
    }}
    {...extra}
  />
);

// Decorative constellation for the dark hero panel — yellow at low opacity.
const HERO_ICONS = [
  [GraduationCap, { bottom: "13%", left: "5%", width: 150, height: 150, transform: "rotate(-10deg)", opacity: 0.18 }],
  [Network, { top: "11%", left: "7%", width: 118, height: 118, opacity: 0.15, filter: "blur(1px)" }],
  [Blocks, { top: "38%", right: "5%", width: 92, height: 92, transform: "rotate(14deg)", opacity: 0.16 }],
  [School, { bottom: "25%", right: "10%", width: 72, height: 72, opacity: 0.14 }],
  [BookOpen, { top: "20%", right: "25%", width: 58, height: 58, transform: "rotate(10deg)", opacity: 0.18 }],
  [ChartColumn, { top: "10%", right: "11%", width: 46, height: 46, opacity: 0.15 }],
  [Award, { top: "56%", left: "31%", width: 42, height: 42, opacity: 0.2 }],
  [Zap, { top: "68%", right: "31%", width: 44, height: 44, transform: "rotate(16deg)", opacity: 0.16 }],
  [Bell, { bottom: "41%", left: "36%", width: 38, height: 38, opacity: 0.14 }],
  [Cloud, { top: "6%", right: "38%", width: 52, height: 52, opacity: 0.13 }],
  [Orbit, { bottom: "7%", right: "7%", width: 72, height: 72, opacity: 0.13 }],
];

// Decorative constellation for the light (form) panel — yellow at low opacity.
const FORM_ICONS = [
  [GraduationCap, { top: "5%", right: "7%", width: 88, height: 88, transform: "rotate(12deg)", opacity: 0.2 }],
  [BookOpen, { bottom: "7%", left: "5%", width: 84, height: 84, transform: "rotate(-9deg)", opacity: 0.2 }],
  [Network, { top: "38%", left: "2.5%", width: 58, height: 58, filter: "blur(2px)", opacity: 0.17 }],
  [ChartColumn, { bottom: "28%", right: "3%", width: 62, height: 62, opacity: 0.17 }],
  [School, { top: "11%", left: "9%", width: 42, height: 42, opacity: 0.2 }],
  [Blocks, { top: "54%", right: "11%", width: 50, height: 50, transform: "rotate(8deg)", opacity: 0.17 }],
  [ClipboardList, { top: "24%", right: "24%", width: 36, height: 36, opacity: 0.17 }],
  [Pencil, { bottom: "44%", left: "23%", width: 36, height: 36, opacity: 0.17 }],
  [Bell, { bottom: "12%", right: "19%", width: 34, height: 34, opacity: 0.17 }],
  [Award, { bottom: "14%", left: "11%", width: 32, height: 32, opacity: 0.2 }],
  [UserRound, { top: "16%", left: "22%", width: 30, height: 30, opacity: 0.15 }],
  [LayoutDashboard, { top: "48%", right: "5%", width: 34, height: 34, opacity: 0.15 }],
];

// Dotted grid used behind both panels (typed as a faint, repeating pattern).
function Dots({ className }) {
  return (
    <div
      aria-hidden="true"
      className={className}
      style={{
        position: "absolute",
        inset: 0,
        backgroundImage:
          "radial-gradient(circle, rgba(232,163,61,0.35) 1px, transparent 1.2px)",
        backgroundSize: "26px 26px",
        maskImage: "radial-gradient(120% 100% at 30% 0%, black 30%, transparent 75%)",
        WebkitMaskImage:
          "radial-gradient(120% 100% at 30% 0%, black 30%, transparent 75%)",
      }}
    />
  );
}

// Dark hero panel decorations: soft yellow glows + dotted grid + object constellation.
export function HeroDecor() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      <Dots className="opacity-[0.12]" />
      <div className="absolute -top-44 -left-40 w-[560px] h-[560px] rounded-full bg-amber/10 blur-3xl" />
      <div className="absolute top-1/3 -right-32 w-[440px] h-[440px] rounded-full bg-amber/[0.06] blur-3xl" />
      <div className="absolute -bottom-40 left-1/4 w-[480px] h-[480px] rounded-full bg-amber/[0.07] blur-3xl" />
      <div className="absolute top-[30%] left-[14%]">
        <Sparkles
          className="text-amber/30"
          style={{ width: 34, height: 34, animation: "auth-twinkle 3.5s ease-in-out 0.6s infinite", willChange: "transform" }}
          strokeWidth={1.4}
        />
      </div>
      <div className="absolute bottom-[18%] right-[26%]">
        <Sparkles
          className="text-amber/25"
          style={{ width: 22, height: 22, animation: "auth-twinkle 4.2s ease-in-out 2s infinite", willChange: "transform" }}
          strokeWidth={1.4}
        />
      </div>
      {HERO_ICONS.map(([Icon, style], i) => PLACED(Icon, style, i, { className: "text-amber" }))}
    </div>
  );
}

// Light (form) panel decorations: soft yellow glow + object constellation.
export function FormDecor() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute -top-24 -right-24 w-[420px] h-[420px] rounded-full bg-amber/15 blur-3xl" />
      <div className="absolute -bottom-32 -left-28 w-[380px] h-[380px] rounded-full bg-amber/10 blur-3xl" />
      {FORM_ICONS.map(([Icon, style], i) => PLACED(Icon, style, i, { className: "text-amber" }))}
    </div>
  );
}