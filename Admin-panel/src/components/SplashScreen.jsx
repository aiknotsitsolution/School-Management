import { useEffect, useState } from "react";

const CORNER_RINGS = [
  { top: "8%", left: "6%", size: 70, delay: 0.2, rotate: 25 },
  { top: "12%", right: "8%", size: 55, delay: 0.4, rotate: -15 },
  { bottom: "15%", left: "10%", size: 60, delay: 0.5, rotate: 40 },
  { bottom: "10%", right: "6%", size: 50, delay: 0.3, rotate: -30 },
  { top: "45%", left: "3%", size: 40, delay: 0.7, rotate: 60 },
  { top: "40%", right: "4%", size: 45, delay: 0.6, rotate: -45 },
];

export default function SplashScreen() {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(false), 3400);
    return () => clearTimeout(timer);
  }, []);

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-ink overflow-hidden splash-exit">
      {/* Corner 3D rings */}
      {CORNER_RINGS.map((r, i) => (
        <div
          key={i}
          className="absolute rounded-full border-2 border-amber/25"
          style={{
            width: r.size,
            height: r.size,
            top: r.top,
            left: r.left,
            right: r.right,
            bottom: r.bottom,
            transform: `rotate(${r.rotate}deg) perspective(400px) rotateY(15deg)`,
            animation: `corner-ring-in 1.2s cubic-bezier(0.22,1,0.36,1) ${r.delay}s both`,
          }}
        >
          <div
            className="absolute inset-2 rounded-full border border-amber/15"
            style={{ animation: `corner-ring-pulse 2.5s ease-in-out ${r.delay + 0.5}s infinite` }}
          />
        </div>
      ))}

      {/* Center glow */}
      <div
        className="absolute w-80 h-80 rounded-full"
        style={{
          background: "radial-gradient(circle, rgba(232,163,61,0.1) 0%, transparent 70%)",
          animation: "center-glow 2s ease-out 0.3s both",
        }}
      />

      {/* Main content */}
      <div className="relative z-10 flex flex-col items-center gap-4">
        {/* Logo — 360 rotate in */}
        <div className="relative">
          <div
            className="absolute -inset-6 rounded-full border border-amber/10"
            style={{ animation: "logo-ring-spin 4s linear 0.2s infinite" }}
          />
          <img
            src="/ZipschoolOS-Transparent-logo.png"
            alt="ZipschoolOS"
            className="w-32 h-auto object-contain relative"
            style={{ animation: "logo-spin-in 1.2s cubic-bezier(0.22,1,0.36,1) 0.1s both" }}
          />
        </div>

        {/* Text */}
        <p
          className="font-display text-[22px] font-bold text-white tracking-wide"
          style={{ animation: "splash-fade-in 0.8s ease-out 0.7s both" }}
        >
          ZipschoolOS
        </p>
        <p
          className="text-[12px] text-white/45"
          style={{ animation: "splash-fade-in 0.8s ease-out 1s both" }}
        >
          Powered By <span className="text-amber/70 font-medium">AI Knots IT Solution</span>
        </p>

        {/* Dot spinner */}
        <div className="mt-6" style={{ animation: "splash-fade-in 0.6s ease-out 1.2s both" }}>
          <div className="dot-spinner">
            {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
              <div key={i} className="dot" style={{ "--i": i }} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
