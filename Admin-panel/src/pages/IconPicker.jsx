// Dev tool: pick the Material icon for each navigation slot.
//
// The sidebar used to ship hand-drawn PNG artwork (deleted along with
// `navPngIcons.jsx`). MUI ships ~10.7k icons and guessing which ones read well
// at the 20px rail size is unreliable, so this page renders real candidates for
// every semantic slot and exports the chosen import block.
//
// Slot-based rather than per-item: ~90 nav items collapse to ~14 distinct
// meanings, so one choice per slot is enough. Selections persist in
// localStorage and "Copy" emits a ready-to-paste block for `sidebarNavData.js`
// and `personaNav.js`.
//
// Candidates are static imports on purpose. A computed specifier would work
// under `vite dev` but leaves an unresolvable dynamic import in the production
// bundle, which is not worth it for a dev-only page.

import { useMemo, useState } from "react";
import {
  AccountBalance, AccountBalanceWallet, Analytics, AirportShuttle, Apartment,
  Article, ArticleOutlined, Assignment, AssignmentOutlined, AssignmentTurnedIn,
  AttachMoney, AutoStories, BarChart, Book, BookOutlined, Bookmark, Bookmarks,
  CalendarMonth, CalendarToday, Campaign, CastForEducation, CheckCircle,
  Checklist, Collections, Commute, CreditCard, CurrencyRupee, Dashboard, DateRange,
  Diamond, DirectionsBus, DirectionsBusOutlined, DoneAll, EmojiEvents,
  EmojiEventsOutlined, Equalizer, Event, EventAvailable, EventNote, FactCheck,
  Favorite, FavoriteBorder, FiberManualRecord, GridView, Group, Groups, Home,
  HouseSiding, HowToReg, ImportContacts, Insights, InsertChart, Leaderboard,
  LibraryAdd, LibraryBooks, LocalLibrary, LocalTaxi, Map, MenuBook, MilitaryTech,
  MilitaryTechOutlined, Money, Mood, NewReleases, Notifications,
  NotificationsActive, NotificationsNone, NotificationsOutlined, Payment,
  PaymentsOutlined, PendingActions, Person, PieChart, PresentToAll, Psychology,
  Public, Quiz, Receipt, RequestQuote, Schedule, School, SchoolOutlined, Science,
  Score, SentimentSatisfied, SentimentSatisfiedAlt, ShowChart, Spa, SpeakerNotes,
  SpaceDashboard, Star, TaskAlt, Today, TrendingUp, VolunteerActivism, Wallet,
  WorkspacePremium,
} from "@mui/icons-material";
import CheckIcon from "@mui/icons-material/Check";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import Description from "@mui/icons-material/Description";
import Tooltip from "@mui/material/Tooltip";

const STORAGE_KEY = "erp_nav_icon_slots";

/**
 * Candidate entries are `[name, Component]` pairs rather than bare components.
 *
 * MUI does not expose the icon name on the component: it passes it to
 * `createSvgIcon(jsx, "Name")`, which only becomes an SVG `data-testid`.
 * `Component.displayName` is therefore always undefined, and reading the name
 * off the inner function (`Component.render.name`) would break under a
 * production build because the minifier mangles it. So the name is written down
 * here, and `scripts/verify-icon-picker-names.js` checks every `ic("Name", …)`
 * against the `@mui/icons-material` barrel so a typo cannot ship.
 */
const ic = (name, Cmp) => [name, Cmp];

/** slot -> candidates, ordered "most likely first". */
const ICON_SLOTS = {
  dashboard: {
    label: "Dashboard",
    hint: "Role landing page",
    options: [
      ic("SpaceDashboard", SpaceDashboard), ic("Dashboard", Dashboard),
      ic("Home", Home), ic("GridView", GridView), ic("HouseSiding", HouseSiding),
      ic("Public", Public), ic("Apartment", Apartment), ic("Group", Group),
    ],
  },
  analytics: {
    label: "Analytics / Reports",
    hint: "Charts and number dashboards",
    options: [
      ic("Insights", Insights), ic("InsertChart", InsertChart), ic("BarChart", BarChart),
      ic("ShowChart", ShowChart), ic("TrendingUp", TrendingUp), ic("Analytics", Analytics),
      ic("PieChart", PieChart), ic("Leaderboard", Leaderboard), ic("Equalizer", Equalizer),
      ic("PresentToAll", PresentToAll),
    ],
  },
  attendance: {
    label: "Attendance",
    hint: "Present / mark the register",
    options: [
      ic("FactCheck", FactCheck), ic("HowToReg", HowToReg),
      ic("EventAvailable", EventAvailable), ic("CheckCircle", CheckCircle),
      ic("AssignmentTurnedIn", AssignmentTurnedIn), ic("DoneAll", DoneAll),
      ic("Checklist", Checklist), ic("TaskAlt", TaskAlt),
    ],
  },
  calendar: {
    label: "Calendar / Timetable",
    hint: "Dates, sessions, schedule",
    options: [
      ic("CalendarMonth", CalendarMonth), ic("Event", Event),
      ic("CalendarToday", CalendarToday), ic("DateRange", DateRange),
      ic("EventNote", EventNote), ic("Today", Today), ic("Schedule", Schedule),
    ],
  },
  homework: {
    label: "Homework / Tasks",
    hint: "Work assigned to students",
    options: [
      ic("TaskAlt", TaskAlt), ic("Assignment", Assignment),
      ic("AssignmentTurnedIn", AssignmentTurnedIn), ic("Checklist", Checklist),
      ic("PendingActions", PendingActions), ic("AssignmentOutlined", AssignmentOutlined),
      ic("DoneAll", DoneAll),
    ],
  },
  exams: {
    label: "Exams / Tests",
    hint: "Quizzes, grading, results",
    options: [
      ic("Quiz", Quiz), ic("Score", Score), ic("Science", Science),
      ic("CheckCircle", CheckCircle), ic("Group", Group), ic("School", School),
      ic("EventNote", EventNote), ic("Book", Book),
    ],
  },
  syllabus: {
    label: "Syllabus / Documents",
    hint: "Curriculum, notes, files",
    options: [
      ic("MenuBook", MenuBook), ic("Description", Description), ic("Article", Article),
      ic("LibraryBooks", LibraryBooks), ic("Book", Book), ic("LocalLibrary", LocalLibrary),
      ic("ArticleOutlined", ArticleOutlined), ic("BookOutlined", BookOutlined),
    ],
  },
  books: {
    label: "Books / Library",
    hint: "Catalog, issue, circulation",
    options: [
      ic("AutoStories", AutoStories), ic("LibraryBooks", LibraryBooks),
      ic("MenuBook", MenuBook), ic("Book", Book), ic("Collections", Collections),
      ic("LocalLibrary", LocalLibrary), ic("LibraryAdd", LibraryAdd),
      ic("ImportContacts", ImportContacts), ic("Bookmark", Bookmark),
      ic("Bookmarks", Bookmarks),
    ],
  },
  notices: {
    label: "Notices / Announcements",
    hint: "Board, circular, alerts",
    options: [
      ic("Campaign", Campaign), ic("Notifications", Notifications),
      ic("NotificationsActive", NotificationsActive),
      ic("NotificationsNone", NotificationsNone),
      ic("NotificationsOutlined", NotificationsOutlined), ic("NewReleases", NewReleases),
      ic("SpeakerNotes", SpeakerNotes), ic("FiberManualRecord", FiberManualRecord),
    ],
  },
  transport: {
    label: "Transport",
    hint: "Buses, routes, tracking",
    options: [
      ic("DirectionsBus", DirectionsBus), ic("LocalTaxi", LocalTaxi),
      ic("AirportShuttle", AirportShuttle), ic("Commute", Commute), ic("Map", Map),
      ic("Public", Public), ic("DirectionsBusOutlined", DirectionsBusOutlined),
    ],
  },
  achievements: {
    label: "Achievements",
    hint: "Awards, ranking, recognition",
    options: [
      ic("EmojiEvents", EmojiEvents), ic("MilitaryTech", MilitaryTech), ic("Star", Star),
      ic("Diamond", Diamond), ic("EmojiEventsOutlined", EmojiEventsOutlined),
      ic("MilitaryTechOutlined", MilitaryTechOutlined), ic("Leaderboard", Leaderboard),
    ],
  },
  graduation: {
    label: "Graduation / Course",
    hint: "Classes, academics, levels",
    options: [
      ic("School", School), ic("WorkspacePremium", WorkspacePremium),
      ic("CastForEducation", CastForEducation), ic("AccountBalance", AccountBalance),
      ic("Groups", Groups), ic("MenuBook", MenuBook), ic("AutoStories", AutoStories),
      ic("SchoolOutlined", SchoolOutlined), ic("Person", Person),
    ],
  },
  behaviour: {
    label: "Behaviour / Wellness",
    hint: "Discipline, mood, counselling",
    options: [
      ic("Psychology", Psychology), ic("SentimentSatisfied", SentimentSatisfied),
      ic("Mood", Mood), ic("Favorite", Favorite),
      ic("VolunteerActivism", VolunteerActivism), ic("Spa", Spa),
      ic("SentimentSatisfiedAlt", SentimentSatisfiedAlt), ic("FavoriteBorder", FavoriteBorder),
    ],
  },
  fees: {
    label: "Fees / Payments",
    hint: "Money in and out",
    options: [
      ic("Payment", Payment), ic("AccountBalanceWallet", AccountBalanceWallet),
      ic("PaymentsOutlined", PaymentsOutlined), ic("CurrencyRupee", CurrencyRupee),
      ic("CreditCard", CreditCard), ic("Money", Money), ic("Receipt", Receipt),
      ic("Wallet", Wallet), ic("AttachMoney", AttachMoney), ic("RequestQuote", RequestQuote),
    ],
  },
};

const defaultSelection = () => {
  const out = {};
  for (const [slot, def] of Object.entries(ICON_SLOTS)) {
    out[slot] = def.options[0][0];
  }
  return out;
};

export default function IconPicker() {
  const [picked, setPicked] = useState(() => {
    let stored = {};
    try {
      stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") || {};
    } catch {
      /* corrupt entry — fall back to defaults */
    }
    const out = {};
    for (const [slot, def] of Object.entries(ICON_SLOTS)) {
      const want = stored[slot];
      // Ignore a stored pick that is no longer offered, so editing the candidate
      // list cannot leave a stale name selected.
      out[slot] = def.options.some(([n]) => n === want) ? want : def.options[0][0];
    }
    return out;
  });
  const [copied, setCopied] = useState(false);

  const choose = (slot, name) => {
    setPicked((prev) => {
      const next = { ...prev, [slot]: name };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* private mode — the pick still applies for this session */
      }
      return next;
    });
  };

  const reset = () => {
    localStorage.removeItem(STORAGE_KEY);
    setPicked(defaultSelection);
  };

  // De-duplicate: several slots may legitimately pick the same icon.
  const used = useMemo(() => [...new Set(Object.values(picked))].sort(), [picked]);

  const exportText = useMemo(
    () =>
      [
        "// 1) imports for sidebarNavData.js (and personaNav.js where noted)",
        ...used.map((n) => `import ${n} from "@mui/icons-material/${n}";`),
        "",
        "// 2) slot -> icon value",
        ...Object.entries(picked).map(([slot, name]) => `${slot}: ${name}`),
        "",
        "// personaNav.js uses: dashboard, attendance, notices, books, transport",
      ].join("\n"),
    [picked, used],
  );

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(exportText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard blocked — the textarea is selectable by hand */
    }
  };

  return (
    <div className="max-w-6xl mx-auto pb-24">
      <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink">Sidebar icon picker</h1>
          <p className="text-[13px] text-slate-text mt-1 max-w-2xl">
            Har slot ke candidates 20px pe render ho rahe hain — wahi size jo sidebar me hai.
            Click karke choose karein, phir neeche "Copy" se code le kar mujhe de dein.
          </p>
        </div>
        <button
          type="button"
          onClick={reset}
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-[12px] font-semibold text-slate-text hover:bg-slate-100"
        >
          Reset all
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {Object.entries(ICON_SLOTS).map(([slot, def]) => (
          <section key={slot} className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <header className="flex items-baseline justify-between gap-2 px-3.5 py-2.5 border-b border-slate-100">
              <div className="min-w-0">
                <h2 className="text-[13.5px] font-bold text-ink">{def.label}</h2>
                <p className="text-[11.5px] text-slate-text">{def.hint}</p>
              </div>
              <code className="text-[11px] text-primary-dark shrink-0">{picked[slot]}</code>
            </header>

            <div className="flex flex-wrap gap-1 p-2.5">
              {def.options.map(([name, Cmp]) => {
                const active = name === picked[slot];
                return (
                  <Tooltip key={name} title={name} placement="top" enterDelay={200}>
                    <button
                      type="button"
                      onClick={() => choose(slot, name)}
                      aria-label={name}
                      aria-pressed={active}
                      className={`grid place-items-center h-10 w-10 rounded-lg border transition-colors ${
                        active
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-slate-200 text-slate-text hover:border-primary/40 hover:bg-primary/5"
                      }`}
                    >
                      <Cmp fontSize="small" />
                    </button>
                  </Tooltip>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      <section className="mt-8 rounded-xl border border-slate-200 bg-white overflow-hidden">
        <header className="flex items-center justify-between gap-3 px-3.5 py-2.5 border-b border-slate-100">
          <div>
            <h2 className="text-[13.5px] font-bold text-ink">Ready to paste</h2>
            <p className="text-[11.5px] text-slate-text">
              {used.length} unique imports · {Object.keys(ICON_SLOTS).length} slot mappings
            </p>
          </div>
          <button
            type="button"
            onClick={copy}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-[12px] font-semibold text-slate-text hover:bg-primary/5 hover:text-primary"
          >
            {copied ? <CheckIcon fontSize="small" /> : <ContentCopyIcon fontSize="small" />}
            {copied ? "Copied" : "Copy"}
          </button>
        </header>
        <textarea
          readOnly
          value={exportText}
          onFocus={(e) => e.currentTarget.select()}
          rows={Math.min(20, exportText.split("\n").length + 1)}
          className="w-full resize-y bg-slate-50 px-3.5 py-3 text-[11.5px] font-mono text-ink outline-none"
        />
      </section>
    </div>
  );
}
