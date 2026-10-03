import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Sparkles } from "lucide-react";

const CelebrationContext = createContext(null);

const CONFETTI_COLORS = ["#0C47CF", "#E9424E", "#F59E0B", "#22C55E", "#38BDF8", "#A855F7"];
const DISMISS_AFTER = 2900;

function makePieces(count) {
  return Array.from({ length: count }, (_, i) => ({
    id: `${Date.now()}-${i}`,
    left: Math.random() * 100,
    delay: Math.random() * 0.55,
    duration: 1.7 + Math.random() * 1.3,
    spin: Math.random() * 720 - 360,
    drift: Math.random() * 140 - 70,
    size: 6 + Math.random() * 7,
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    round: Math.random() > 0.6,
  }));
}

export function CelebrationProvider({ children }) {
  const [event, setEvent] = useState(null);
  const [pieces, setPieces] = useState([]);
  const timer = useRef(null);

  const celebrate = useCallback((payload = {}) => {
    setEvent({
      title: payload.title || "Nice work",
      message: payload.message || "",
    });
    setPieces(makePieces(payload.pieces ?? 64));
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setEvent(null);
      setPieces([]);
    }, DISMISS_AFTER);
  }, []);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const value = useMemo(() => ({ celebrate }), [celebrate]);

  return (
    <CelebrationContext.Provider value={value}>
      {children}

      {pieces.length > 0 && (
        <div className="pointer-events-none fixed inset-0 z-[100] overflow-hidden" aria-hidden="true">
          {pieces.map((p) => (
            <span
              key={p.id}
              className="celebrate-confetti absolute top-0 block"
              style={{
                left: `${p.left}%`,
                width: p.size,
                height: p.round ? p.size : p.size * 0.5,
                background: p.color,
                borderRadius: p.round ? "999px" : "2px",
                "--delay": `${p.delay}s`,
                "--dur": `${p.duration}s`,
                "--drift": `${p.drift}px`,
                "--spin": `${p.spin}deg`,
              }}
            />
          ))}
        </div>
      )}

      {event && (
        <div className="pointer-events-none fixed inset-x-0 top-[16vh] z-[101] flex justify-center px-4">
          <div
            role="status"
            className="celebrate-pop max-w-[min(92vw,26rem)] rounded-2xl border border-primary/20 bg-white/95 px-6 py-4 text-center shadow-[0_30px_70px_-30px_rgba(12,71,207,0.65)] backdrop-blur-md"
          >
            <p className="flex items-center justify-center gap-2 font-display text-[17px] font-bold tracking-tight text-ink">
              <Sparkles size={18} className="shrink-0 text-brand" aria-hidden="true" />
              {event.title}
            </p>
            {event.message && (
              <p className="mt-1.5 text-[12.5px] font-medium leading-snug text-slate-text/75">
                {event.message}
              </p>
            )}
          </div>
        </div>
      )}
    </CelebrationContext.Provider>
  );
}

const noop = () => {};

export function useCelebrate() {
  const ctx = useContext(CelebrationContext);
  return ctx ? ctx.celebrate : noop;
}
