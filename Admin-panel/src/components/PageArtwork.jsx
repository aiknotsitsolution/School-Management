// Page artwork for empty states and page headers.
//
// The illustrations are 1024px source files, so they are always rendered at a
// small display size — the source resolution is only there to stay crisp.
import attendanceArt from "../assets/icons/attendance-icon.png";
import booksArt from "../assets/icons/Books-With-cap.png";
import busArt from "../assets/icons/transport-map.png";
import calendarArt from "../assets/icons/calender-icon.png";
import chartArt from "../assets/icons/charticon.png";
import dashboardArt from "../assets/icons/dashboard-icon.png";
import homeworkArt from "../assets/icons/homework&assignement.png";
import noticesArt from "../assets/icons/comms-calendar.png";
import syllabusArt from "../assets/icons/doc-inspection.png";
import achievementsArt from "../assets/icons/achievementsArt.png";
import graduationArt from "../assets/icons/diploma.png";
import feesArt from "../assets/icons/fee&payments.png";
import examsArt from "../assets/icons/examinations.png";

const ART = {
  achievements: achievementsArt,
  attendance: attendanceArt,
  bus: busArt,
  calendar: calendarArt,
  chart: chartArt,
  dashboard: dashboardArt,
  exams: examsArt,
  fees: feesArt,
  homework: homeworkArt,
  library: booksArt,
  notices: noticesArt,
  students: graduationArt,
  syllabus: syllabusArt,
};

// Lucide icon name → artwork, for the icons we have a real illustration for.
// Anything absent here (fees, payroll, inventory, leaves, messages...) keeps
// its lucide icon, since no honest substitute exists.
const LUCIDE_TO_ART = {
  // students / people
  GraduationCap: "students",
  School: "students",
  User: "students",
  UserCheck: "students",
  UserCog: "students",
  UserPlus: "students",
  UserRound: "students",
  UserRoundCog: "students",
  Users: "students",
  BriefcaseBusiness: "students",
  HeartPulse: "students",

  // attendance & calendar
  CalendarCheck: "attendance",
  CalendarCheck2: "attendance",
  CalendarClock: "calendar",
  CalendarDays: "calendar",
  CalendarRange: "calendar",
  Calendar: "calendar",
  Clock: "calendar",
  Clock3: "calendar",
  AlarmClock: "calendar",
  TimerReset: "calendar",
  FileClock: "calendar",

  // library / books / syllabus
  BookMarked: "library",
  BookOpen: "library",
  BookOpenCheck: "library",
  BookPlus: "library",
  Library: "library",
  LibraryBig: "library",
  PenLine: "syllabus",

  // homework & assignments
  Briefcase: "homework",
  ClipboardCheck: "homework",
  ClipboardList: "homework",

  // analytics & results
  Activity: "chart",
  Award: "chart",
  BadgeCheck: "achievements",
  BarChart3: "chart",
  Gauge: "chart",
  Medal: "achievements",
  Sparkles: "achievements",
  Star: "achievements",
  TrendingUp: "chart",
  Trophy: "achievements",

  // notifications
  Bell: "notices",
  Inbox: "notices",
  Megaphone: "notices",

  // fees & payments
  IndianRupee: "fees",
  Receipt: "fees",
  Wallet: "fees",
  CreditCard: "fees",

  // transport
  Bus: "bus",
  Car: "bus",
  CarFront: "bus",
  DoorOpen: "bus",
  MapPin: "bus",
  Navigation: "bus",
  Route: "bus",
};

/** Artwork name for a lucide icon component, or undefined when we have no
 *  matching illustration and the lucide icon should be kept. */
export function artworkForLucide(Icon) {
  if (!Icon) return undefined;
  return LUCIDE_TO_ART[Icon.displayName || Icon.name];
}

/* Vector decorations.
 *
 * Unlike ART — which maps a name to a 1024px PNG illustration — these are inline
 * SVGs painted with `currentColor`, so a caller can tint one with a single
 * accent class (`text-emerald-600`) and it recolours itself. They are meant to
 * sit behind content as a texture, not to be read as an illustration, so they
 * carry no `size` and fill whatever box they are given.
 */

/** One sine-ish crest. Kept as a function so the bands stay in phase and read
 *  as one body of water rather than four unrelated squiggles. */
const crest = (y) =>
  `M-20 ${y}C20 ${y - 18} 60 ${y + 18} 100 ${y}C140 ${y - 18} 180 ${y + 18} 220 ${y}`;

/** Tilt of the whole design, in degrees, about the centre of the viewBox. The
 *  crests are drawn horizontal and rotated here, rather than putting a
 *  `rotate-45` class on the element — rotating the box itself would leave its
 *  corners uncovered. */
const TILT = -45;

function Waves({ className = "" }) {
  return (
    <svg
      viewBox="0 0 200 200"
      // Centred, because the tilt pulls content past every edge and the crop
      // should be symmetric.
      preserveAspectRatio="xMidYMid slice"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <g transform={`rotate(${TILT} 100 100)`}>
        {/* Water body. */}
        <path d={`${crest(128)}L220 220L-20 220Z`} fill="currentColor" opacity="0.16" />
        {/* Crests, fading as they rise so the gradient reads as depth. */}
        <g stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <path d={crest(128)} opacity="0.62" />
          <path d={crest(96)} opacity="0.44" />
          <path d={crest(64)} opacity="0.28" />
          <path d={crest(32)} opacity="0.15" />
        </g>
        {/* Concentric ripples to break up the banding on a large card. */}
        <g stroke="currentColor" strokeWidth="2" opacity="0.12">
          <circle cx="168" cy="52" r="14" />
          <circle cx="168" cy="52" r="26" />
          <circle cx="168" cy="52" r="38" />
        </g>
      </g>
    </svg>
  );
}

/** Rows of a day: a time tick plus a period bar of its own length, so the
 *  motif reads as a timetable filling up rather than as more water. Opacities
 *  climb downward to suggest the day progressing. */
const PERIOD_ROWS = [
  { y: 40, w: 60, o: 0.46 },
  { y: 68, w: 94, o: 0.38 },
  { y: 96, w: 42, o: 0.3 },
  { y: 124, w: 108, o: 0.23 },
  { y: 152, w: 72, o: 0.16 },
  { y: 180, w: 86, o: 0.1 },
];

function Periods({ className = "" }) {
  return (
    <svg
      viewBox="0 0 200 200"
      preserveAspectRatio="xMidYMid slice"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <g transform={`rotate(${TILT} 100 100)`}>
        <g fill="currentColor">
          {PERIOD_ROWS.map((r) => (
            <rect key={r.y} x="44" y={r.y} width={r.w} height="11" rx="5.5" opacity={r.o} />
          ))}
        </g>
        {/* Time ticks, aligned to the left edge of each bar. */}
        <g stroke="currentColor" strokeWidth="3" strokeLinecap="round" opacity="0.34">
          {PERIOD_ROWS.map((r) => (
            <path key={r.y} d={`M22 ${r.y + 5.5}h9`} />
          ))}
        </g>
      </g>
    </svg>
  );
}

/** A week above, a single day below: the seven column rules along the top are
 *  the week, and the gutter with its stacked blocks is one day of that week
 *  filling up. Distinct from `periods`, which is a flat run of bars — here the
 *  two scales are meant to be read against each other.
 *
 *  The decor strip is tall and narrow and crops with `slice`, so everything is
 *  held inside the middle band of the viewBox (roughly x 54-146) — anything
 *  drawn near the edges would be sliced off on a long card. */
const WEEK_COLUMNS = Array.from({ length: 7 }, (_, i) => 58 + i * 14);
const DAY_TICKS = [34, 68, 102, 136, 170];
const DAY_BLOCKS = [
  { y: 28, w: 66 },
  { y: 62, w: 46 },
  { y: 96, w: 74 },
  { y: 130, w: 40 },
  { y: 164, w: 58 },
];

function Weekgrid({ className = "" }) {
  return (
    <svg viewBox="0 0 200 200" preserveAspectRatio="xMidYMid slice" fill="none" className={className} aria-hidden="true">
      {/* Week columns. The middle one runs taller — the day the view is on. */}
      <g stroke="currentColor" strokeWidth="3" strokeLinecap="round">
        {WEEK_COLUMNS.map((x, i) => (
          <path key={x} d={`M${x} 24v${i === 3 ? 24 : 14}`} opacity={i === 3 ? 0.5 : 0.2} />
        ))}
      </g>
      {/* The rule that binds the week to the day hanging below it. */}
      <path d="M56 48h88" stroke="currentColor" strokeWidth="3" strokeLinecap="round" opacity="0.3" />
      {/* Time gutter down that day. */}
      <g stroke="currentColor" strokeWidth="3" strokeLinecap="round" opacity="0.18">
        {DAY_TICKS.map((y) => (
          <path key={y} d={`M56 ${y}h8`} />
        ))}
      </g>
      <g fill="currentColor">
        {DAY_BLOCKS.map((b, i) => (
          <rect key={b.y} x="70" y={b.y} width={b.w} height="11" rx="5.5" opacity={0.42 - i * 0.07} />
        ))}
      </g>
    </svg>
  );
}

/** A horizontal timeline strip: narrow track with period blocks fading to the right.
 *  Designed for wide, short bottom bands (keeps its shape under slice scaling). */
function TimetableStrip({ className = "" }) {
  const blocks = [
    { x: 40, w: 26 },
    { x: 70, w: 22 },
    { x: 96, w: 30 },
    { x: 130, w: 20 },
    { x: 154, w: 14 },
  ];
  return (
    <svg viewBox="0 0 200 200" preserveAspectRatio="xMidYMid slice" fill="none" className={className} aria-hidden="true">
      <path d="M36 96h128" stroke="currentColor" strokeWidth="4" strokeLinecap="round" opacity="0.24" />
      <g fill="currentColor">
        {blocks.map((b, i) => (
          <rect
            key={b.x}
            x={b.x}
            y="90"
            width={b.w}
            height="12"
            rx="6"
            opacity={0.36 - i * 0.07}
          />
        ))}
      </g>
      <path d="M156 90h10v12h-10z" fill="currentColor" opacity="0.12" />
    </svg>
  );
}

/** Marks in a register: ticked cells read as present, a plain dot as absent. */
const ATTEND_CELLS = [1, 0, 1, 1, 1, 0, 0, 1, 1];

function Attend({ className = "" }) {
  return (
    <svg viewBox="0 0 200 200" preserveAspectRatio="xMidYMid slice" fill="none" className={className} aria-hidden="true">
      <g>
        {ATTEND_CELLS.map((ticked, i) => {
          const x = 46 + (i % 3) * 42;
          const y = 50 + Math.floor(i / 3) * 42;
          return ticked ? (
            <path
              key={i}
              d={`M${x - 3} ${y}l8 8 14-16`}
              stroke="currentColor"
              strokeWidth="5"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity="0.5"
            />
          ) : (
            <circle key={i} cx={x + 8} cy={y + 1} r="6" fill="currentColor" opacity="0.26" />
          );
        })}
      </g>
    </svg>
  );
}

/** A stack of coins, for anything money-shaped: fees, salary, payouts. */
function Coins({ className = "" }) {
  return (
    <svg viewBox="0 0 200 200" preserveAspectRatio="xMidYMid slice" fill="none" className={className} aria-hidden="true">
      <g fill="currentColor">
        {[0, 1, 2, 3].map((i) => (
          <ellipse key={i} cx="100" cy={156 - i * 30} rx="48" ry="16" opacity={0.1 + i * 0.09} />
        ))}
      </g>
    </svg>
  );
}

/** Broadcast rings from a corner — an announcement going out. */
function Broadcast({ className = "" }) {
  return (
    <svg viewBox="0 0 200 200" preserveAspectRatio="xMidYMid slice" fill="none" className={className} aria-hidden="true">
      <circle cx="58" cy="142" r="11" fill="currentColor" opacity="0.5" />
      <g stroke="currentColor" strokeWidth="4" strokeLinecap="round">
        {[32, 58, 84, 110, 136].map((r, i) => (
          <circle key={r} cx="58" cy="142" r={r} opacity={0.42 - i * 0.07} />
        ))}
      </g>
    </svg>
  );
}

/** Speed streaks. Reads as a vehicle in motion without drawing a vehicle. */
function Motion({ className = "" }) {
  return (
    <svg viewBox="0 0 200 200" preserveAspectRatio="xMidYMid slice" fill="none" className={className} aria-hidden="true">
      <g stroke="currentColor" strokeWidth="7" strokeLinecap="round">
        {[[52, 116], [82, 74], [112, 132], [142, 58], [172, 100]].map(([y, w], i) => (
          <path key={y} d={`M${40} ${y}h${w}`} opacity={0.5 - i * 0.06} />
        ))}
      </g>
    </svg>
  );
}

/** Three figures, the middle one forward — a group, a roll, a family. */
function People({ className = "" }) {
  return (
    <svg viewBox="0 0 200 200" preserveAspectRatio="xMidYMid slice" fill="none" className={className} aria-hidden="true">
      <g fill="currentColor">
        {[[74, 74, 0.34], [126, 74, 0.24], [100, 106, 0.44]].map(([cx, cy, o]) => (
          <g key={cx} opacity={o}>
            <circle cx={cx} cy={cy} r="15" />
            <path d={`M${cx - 26} ${cy + 52}a26 26 0 0 1 52 0z`} />
          </g>
        ))}
      </g>
    </svg>
  );
}

/** A rising bar series, for trends and result summaries. */
function Trend({ className = "" }) {
  return (
    <svg viewBox="0 0 200 200" preserveAspectRatio="xMidYMid slice" fill="none" className={className} aria-hidden="true">
      <path d="M36 172h132" stroke="currentColor" strokeWidth="4" strokeLinecap="round" opacity="0.22" />
      <g fill="currentColor">
        {[[46, 38], [84, 62], [122, 50], [160, 86]].map(([x, h], i) => (
          <rect key={x} x={x} y={168 - h} width="20" height={h} rx="10" opacity={0.18 + i * 0.11} />
        ))}
      </g>
    </svg>
  );
}

/** A month grid with today ringed — the one date that matters. */
function Events({ className = "" }) {
  const cells = Array.from({ length: 15 }, (_, i) => i);
  const TODAY = 7;
  return (
    <svg viewBox="0 0 200 200" preserveAspectRatio="xMidYMid slice" fill="none" className={className} aria-hidden="true">
      <g fill="currentColor">
        {cells.map((i) => {
          const x = 44 + (i % 5) * 30;
          const y = 56 + Math.floor(i / 5) * 30;
          if (i === TODAY) return <circle key={i} cx={x} cy={y} r="11" opacity="0.55" />;
          return <circle key={i} cx={x} cy={y} r="7" opacity={i % 4 === 0 ? 0.4 : 0.18} />;
        })}
      </g>
    </svg>
  );
}

/** A sealed envelope, for notification and message surfaces. */
function Envelope({ className = "" }) {
  return (
    <svg viewBox="0 0 200 200" preserveAspectRatio="xMidYMid slice" fill="none" className={className} aria-hidden="true">
      <g stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="38" y="56" width="124" height="88" rx="14" opacity="0.4" />
        <path d="M44 70l56 42 56-42" opacity="0.5" />
      </g>
    </svg>
  );
}

/** A to-do list: a checkbox and a line of work per row, some already done.
 *  Rows-and-lines, so it stays distinct from the register grid in `attend`. */
const TASK_ROWS = [
  { y: 42, w: 96, done: true },
  { y: 74, w: 70, done: false },
  { y: 106, w: 104, done: true },
  { y: 138, w: 60, done: false },
  { y: 170, w: 88, done: true },
];

function Tasks({ className = "" }) {
  return (
    <svg viewBox="0 0 200 200" preserveAspectRatio="xMidYMid slice" fill="none" className={className} aria-hidden="true">
      <g>
        {TASK_ROWS.map((r) => {
          const cy = r.y + 6.5;
          return (
            <g key={r.y}>
              <rect
                x="40"
                y={r.y}
                width="13"
                height="13"
                rx="4"
                stroke="currentColor"
                strokeWidth="3"
                opacity={r.done ? 0.5 : 0.26}
              />
              {r.done && (
                <path
                  d={`M43 ${cy}l3.5 3.5 6-7`}
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity="0.55"
                />
              )}
              <path
                d={`M62 ${cy}h${r.w}`}
                stroke="currentColor"
                strokeWidth="4"
                strokeLinecap="round"
                opacity={r.done ? 0.28 : 0.4}
              />
            </g>
          );
        })}
      </g>
    </svg>
  );
}

/** Book spines standing on a shelf line. */
function Books({ className = "" }) {
  return (
    <svg viewBox="0 0 200 200" preserveAspectRatio="xMidYMid slice" fill="none" className={className} aria-hidden="true">
      <g fill="currentColor">
        {[[46, 62], [74, 84], [102, 56], [130, 90], [158, 70]].map(([x, h], i) => (
          <rect key={x} x={x} y={158 - h} width="20" height={h} rx="4" opacity={0.14 + i * 0.09} />
        ))}
      </g>
      <path d="M34 166h136" stroke="currentColor" strokeWidth="4" strokeLinecap="round" opacity="0.3" />
    </svg>
  );
}

/** Isometric boxes, one per layer — stock on a shelf, plans in a stack. */
function Stack({ className = "" }) {
  return (
    <svg viewBox="0 0 200 200" preserveAspectRatio="xMidYMid slice" fill="none" className={className} aria-hidden="true">
      <g fill="currentColor">
        {[0, 1, 2].map((i) => (
          <path key={i} d={`M100 ${44 + i * 42}l50 24-50 24-50-24z`} opacity={0.14 + i * 0.1} />
        ))}
      </g>
    </svg>
  );
}

/** A two-column book: description on the left, amount on the right. */
function Ledger({ className = "" }) {
  return (
    <svg viewBox="0 0 200 200" preserveAspectRatio="xMidYMid slice" fill="none" className={className} aria-hidden="true">
      <g stroke="currentColor" strokeWidth="4" strokeLinecap="round">
        {[52, 84, 116, 148].map((y, i) => (
          <g key={y}>
            <path d={`M42 ${y}h${68 - i * 8}`} opacity="0.34" />
            <path d={`M148 ${y}h14`} opacity="0.5" />
          </g>
        ))}
      </g>
      <path d="M126 44v112" stroke="currentColor" strokeWidth="2" strokeDasharray="4 6" opacity="0.22" />
    </svg>
  );
}

/** A single sheet with a folded corner — anything document-shaped. */
function Sheet({ className = "" }) {
  return (
    <svg viewBox="0 0 200 200" preserveAspectRatio="xMidYMid slice" fill="none" className={className} aria-hidden="true">
      <g stroke="currentColor" strokeWidth="4" strokeLinejoin="round">
        <path d="M58 36h50l34 34v94a6 6 0 0 1-6 6H58a6 6 0 0 1-6-6V42a6 6 0 0 1 6-6z" opacity="0.36" />
        <path d="M108 36v34h34" opacity="0.36" />
      </g>
      <g stroke="currentColor" strokeWidth="4" strokeLinecap="round" opacity="0.34">
        <path d="M72 108h56" />
        <path d="M72 128h40" />
        <path d="M72 148h30" />
      </g>
    </svg>
  );
}

/** A winding path with two stops on it. */
function Route({ className = "" }) {
  return (
    <svg viewBox="0 0 200 200" preserveAspectRatio="xMidYMid slice" fill="none" className={className} aria-hidden="true">
      <path
        d="M46 46c42 0 20 40 56 40s20 42 54 42"
        stroke="currentColor"
        strokeWidth="5"
        strokeLinecap="round"
        strokeDasharray="2 12"
        opacity="0.42"
      />
      <g fill="currentColor">
        <circle cx="46" cy="46" r="13" opacity="0.5" />
        <circle cx="156" cy="128" r="13" opacity="0.32" />
      </g>
    </svg>
  );
}

/** A map pin with a pulse ring. */
function Pin({ className = "" }) {
  return (
    <svg viewBox="0 0 200 200" preserveAspectRatio="xMidYMid slice" fill="none" className={className} aria-hidden="true">
      <circle cx="100" cy="82" r="46" stroke="currentColor" strokeWidth="3" opacity="0.16" />
      <path d="M100 36a32 32 0 0 0-32 32c0 24 32 56 32 56s32-32 32-56a32 32 0 0 0-32-32z" fill="currentColor" opacity="0.28" />
      <circle cx="100" cy="68" r="12" fill="currentColor" opacity="0.55" />
    </svg>
  );
}

/** A wide-to-narrow funnel. */
function Funnel({ className = "" }) {
  return (
    <svg viewBox="0 0 200 200" preserveAspectRatio="xMidYMid slice" fill="none" className={className} aria-hidden="true">
      <path d="M34 44h132l-52 60v50l-28 14v-64z" fill="currentColor" opacity="0.3" />
    </svg>
  );
}

/** Sand running out — anything with a deadline. */
function Hourglass({ className = "" }) {
  return (
    <svg viewBox="0 0 200 200" preserveAspectRatio="xMidYMid slice" fill="none" className={className} aria-hidden="true">
      <g stroke="currentColor" strokeWidth="5" strokeLinecap="round">
        <path d="M60 38h80M60 162h80" opacity="0.42" />
        <path d="M66 42c0 30 34 40 34 58s-34 28-34 58" opacity="0.3" />
        <path d="M134 42c0 30-34 40-34 58s34 28 34 58" opacity="0.3" />
      </g>
      <path d="M100 108l-9 20h18z" fill="currentColor" opacity="0.5" />
    </svg>
  );
}

/** A heartbeat trace — audit logs, activity feeds. */
function Pulse({ className = "" }) {
  return (
    <svg viewBox="0 0 200 200" preserveAspectRatio="xMidYMid slice" fill="none" className={className} aria-hidden="true">
      <path
        d="M26 100h30l14-32 20 64 18-44 12 24h54"
        stroke="currentColor"
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.42"
      />
    </svg>
  );
}

/** A clock face. */
function ClockFace({ className = "" }) {
  return (
    <svg viewBox="0 0 200 200" preserveAspectRatio="xMidYMid slice" fill="none" className={className} aria-hidden="true">
      <circle cx="100" cy="100" r="52" stroke="currentColor" strokeWidth="5" opacity="0.32" />
      <g stroke="currentColor" strokeWidth="6" strokeLinecap="round" opacity="0.5">
        <path d="M100 70v32l24 16" />
      </g>
    </svg>
  );
}

/** A handset. */
function Phone({ className = "" }) {
  return (
    <svg viewBox="0 0 200 200" preserveAspectRatio="xMidYMid slice" fill="none" className={className} aria-hidden="true">
      <path
        d="M58 40l24 28-18 16c10 18 26 34 44 44l16-18 28 24c-4 22-24 36-46 34-42-4-78-40-82-82-2-22 12-42 34-46z"
        fill="currentColor"
        opacity="0.3"
      />
    </svg>
  );
}

/** A magnifier over scattered dots — search results. */
function Search({ className = "" }) {
  return (
    <svg viewBox="0 0 200 200" preserveAspectRatio="xMidYMid slice" fill="none" className={className} aria-hidden="true">
      <circle cx="92" cy="92" r="46" stroke="currentColor" strokeWidth="6" opacity="0.38" />
      <path d="M126 126l32 32" stroke="currentColor" strokeWidth="9" strokeLinecap="round" opacity="0.45" />
      <g fill="currentColor">
        <circle cx="76" cy="78" r="8" opacity="0.3" />
        <circle cx="108" cy="76" r="8" opacity="0.3" />
        <circle cx="78" cy="110" r="8" opacity="0.3" />
        <circle cx="106" cy="108" r="8" opacity="0.3" />
      </g>
    </svg>
  );
}

const DECOR = {
  attend: Attend,
  books: Books,
  broadcast: Broadcast,
  clock: ClockFace,
  coins: Coins,
  envelope: Envelope,
  events: Events,
  funnel: Funnel,
  hourglass: Hourglass,
  ledger: Ledger,
  motion: Motion,
  people: People,
  periods: Periods,
  phone: Phone,
  pin: Pin,
  pulse: Pulse,
  route: Route,
  search: Search,
  sheet: Sheet,
  stack: Stack,
  tasks: Tasks,
  timeline: TimetableStrip,
  trend: Trend,
  waves: Waves,
  weekgrid: Weekgrid,
};

/** Semantic name → PNG. Returns undefined for unknown names so callers can fall
 *  back to their own lucide icon. */
export function artworkSrc(name) {
  return ART[name];
}

export default function PageArtwork({ name, size = 64, className = "", alt = "" }) {
  const Decor = DECOR[name];
  if (Decor) return <Decor className={`shrink-0 select-none ${className}`} />;

  const src = ART[name];
  if (!src) return null;
  return (
    <img
      src={src}
      alt={alt}
      aria-hidden={alt ? undefined : "true"}
      style={{ width: size, height: size, objectFit: "contain" }}
      className={`shrink-0 select-none object-contain ${className}`}
    />
  );
}
