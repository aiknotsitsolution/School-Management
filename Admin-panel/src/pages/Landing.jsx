import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  ArrowRight,
  Backpack,
  BarChart3,
  BellRing,
  BookOpen,
  Bus,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Fingerprint,
  GraduationCap,
  Home,
  Mail,
  MapPin,
  Menu,
  PenLine,
  Phone,
  Quote,
  Rocket,
  School,
  Send,
  ShieldCheck,
  Star,
  UserPlus,
  Users,
  Wallet,
  X,
} from "lucide-react";
import heroImage from "../assets/landing-page/summer-class-hero-image.png";
import quizBanner from "../assets/landing-page/banner-quiz.png";
import homeBanner from "../assets/landing-page/home-center-banner-not hero.jpg";
import parentCoachGif from "../assets/landing-page/Parent-Coach-hero-Image.gif";
import phonicsGif from "../assets/landing-page/phonics-for-hom-hero-1.gif";

/* ───────────────────────────────────────────────────────────────────────────
   Layout tokens. One rhythm for every band on the page.
   ─────────────────────────────────────────────────────────────────────────── */
const SHELL = "mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8";
const BAND = "py-20 sm:py-24 lg:py-28";

/* Always-dark surfaces (hero, contact panel, footer) use fixed light values so
   text stays readable when the app flips to dark mode. */
const ON_DARK_SOFT = "text-[#F1F5F9]/75";

const fieldClass =
  "w-full rounded-control border border-line bg-white px-4 py-3 text-sm text-ink placeholder:text-slate-400 transition duration-200 focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10";

/** Focus ring that survives `overflow-hidden` parents (drawn inset). */
const focusRing =
  "focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary/60";

const stagger = (index, step = 70) => ({ transitionDelay: `${index * step}ms` });

const NAV_LINKS = [
  { label: "Features", href: "#features" },
  { label: "For You", href: "#roles" },
  { label: "How It Works", href: "#steps" },
  { label: "Testimonials", href: "#testimonials" },
  { label: "FAQ", href: "#faq" },
  { label: "Contact", href: "#contact" },
];

const SLIDES = [
  {
    image: heroImage,
    badge: "Seasonal programmes",
    title: "Launch camps, batches & summer classes in minutes",
    sub: "Fee plans, rosters and parent communication for seasonal programmes — ready before your first brochure goes out.",
  },
  {
    image: homeBanner,
    badge: "One platform",
    title: "Your entire school on a single dashboard",
    sub: "Admissions, academics, fees, transport and communication — connected in one place your whole team can use.",
  },
  {
    image: quizBanner,
    badge: "Exams & assessments",
    title: "From quizzes to board exams, without the paper stack",
    sub: "Create tests, auto-mark objective questions and push results home to parents the same day.",
  },
  {
    image: parentCoachGif,
    badge: "Parent app",
    title: "Parents always in the loop",
    sub: "Attendance alerts, homework, results and fee receipts reach parents' phones automatically.",
  },
  {
    image: phonicsGif,
    badge: "Learning resources",
    title: "Content that grows with every class",
    sub: "From phonics and foundational literacy to Class 12 material — digital library and study notes in one place.",
  },
];

const HERO_POINTS = [
  "24-hour online fee collection",
  "Parent & student app",
  "Free guided onboarding",
];

const HERO_JUMPS = [
  { icon: ClipboardList, label: "Platform features", href: "#features" },
  { icon: Rocket, label: "How onboarding works", href: "#steps" },
  { icon: Users, label: "Built for every role", href: "#roles" },
  { icon: Phone, label: "Talk to our team", href: "#contact" },
];

const STATS = [
  { icon: School, value: "500+", label: "Schools onboarded" },
  { icon: Users, value: "1.2M+", label: "Students managed daily" },
  { icon: GraduationCap, value: "80K+", label: "Teachers & staff" },
  { icon: Activity, value: "99.9%", label: "Platform uptime" },
];

const FEATURES = [
  {
    icon: ClipboardList,
    title: "Admissions & Enquiries",
    desc: "Turn every enquiry into an enrolment with an organised lead pipeline, follow-ups and a digital admission flow.",
    tile: "bg-primary-light text-primary",
  },
  {
    icon: Fingerprint,
    title: "Attendance",
    desc: "Record attendance in one tap — class-wise, staff-wise, even on the bus. Instant absence alerts go to parents.",
    tile: "bg-success-light text-success",
  },
  {
    icon: CalendarClock,
    title: "Timetables & Exams",
    desc: "Clash-free timetables, simple marks entry and automatic report cards with your school's own grading scale.",
    tile: "bg-primary-light text-primary",
  },
  {
    icon: Wallet,
    title: "Fees & Accounting",
    desc: "Instalment plans, online payments, instant receipts and clean ledgers that link straight into your accounts.",
    tile: "bg-success-light text-success",
  },
  {
    icon: PenLine,
    title: "Homework & Diary",
    desc: "Daily homework, class diaries and reminders — posted once, seen by parents on the app instantly.",
    tile: "bg-primary-light text-primary",
  },
  {
    icon: BookOpen,
    title: "Library & Books",
    desc: "Manage your catalogue, issue and return books, and give students a digital library with e-books to read.",
    tile: "bg-success-light text-success",
  },
  {
    icon: Bus,
    title: "Transport & Tracking",
    desc: "Routes, buses, stops and live location so parents always know exactly where their child's bus is.",
    tile: "bg-primary-light text-primary",
  },
  {
    icon: BellRing,
    title: "Communication",
    desc: "Notices, broadcasts and circulars reach the right audience in seconds — no more WhatsApp chain chaos.",
    tile: "bg-success-light text-success",
  },
  {
    icon: BarChart3,
    title: "Reports & Analytics",
    desc: "Real-time dashboards for every module, with clean exports the management actually reads.",
    tile: "bg-primary-light text-primary",
  },
];

const ROLES = [
  {
    icon: ShieldCheck,
    title: "School Admin",
    bar: "bg-primary",
    tile: "bg-primary-light text-primary",
    check: "text-primary",
    wash: "from-primary/[0.06]",
    points: [
      "Whole school on one dashboard",
      "Fees, payroll & accounts in one place",
      "Reports the management trusts",
    ],
  },
  {
    icon: GraduationCap,
    title: "Teachers",
    bar: "bg-success",
    tile: "bg-success-light text-success",
    check: "text-success",
    wash: "from-success/[0.06]",
    points: [
      "Mark attendance in seconds",
      "Homework & results in one click",
      "Class-scoped timetables",
    ],
  },
  {
    icon: Home,
    title: "Parents",
    bar: "bg-warning",
    tile: "bg-warning-light text-warning",
    check: "text-warning",
    wash: "from-warning/[0.07]",
    points: [
      "Attendance & results alerts",
      "Instant homework and notices",
      "Live bus tracking",
    ],
  },
  {
    icon: Backpack,
    title: "Students",
    bar: "bg-alert",
    tile: "bg-alert-light text-alert",
    check: "text-alert",
    wash: "from-alert/[0.06]",
    points: [
      "Personal dashboard for tasks",
      "Digital study material & library",
      "Results and timetable on the go",
    ],
  },
];

const STEPS = [
  {
    icon: Rocket,
    step: "01",
    title: "Set up your school",
    desc: "Tell us about your school, sessions and fee structure. We get your profile ready in a day.",
  },
  {
    icon: UserPlus,
    step: "02",
    title: "Onboard staff & students",
    desc: "Invite teachers, register students and map classes, sections and guardians in one go.",
  },
  {
    icon: CheckCircle2,
    step: "03",
    title: "Go live",
    desc: "Switch on timetables, fees, transport and parent app. Your school is live within a week.",
  },
];

const TESTIMONIALS = [
  {
    quote:
      "Administration that used to take us a full week now finishes by Tuesday. Reports, fee reminders and parent updates — all from one dashboard.",
    name: "Ritu Sharma",
    role: "Principal",
    school: "Green Valley Public School, Jaipur",
  },
  {
    quote:
      "My children's attendance, homework and exam results arrive on my phone automatically. I finally know what's happening at school every day.",
    name: "Anil Mehta",
    role: "Parent of two students",
    school: "Springdale International, Pune",
  },
  {
    quote:
      "Timetable clashes are a thing of the past. Roll-over used to take days after exams; now it is a single click and everything carries forward.",
    name: "Farah Khan",
    role: "Academic Coordinator",
    school: "Oxford Senior Secondary, Indore",
  },
];

const FAQS = [
  {
    q: "What is Zipschool OS?",
    a: "Zipschool OS is a complete cloud school management platform that runs admissions, attendance, timetables, exams, fees, transport, library and parent communication from one place.",
  },
  {
    q: "Who is Zipschool OS built for?",
    a: "Schools from Nursery to Class 12 — everything from a single branch to a growing chain. Separate workspaces for admins, teachers, parents, students and staff like accountants or librarians.",
  },
  {
    q: "Do parents and teachers need to install anything?",
    a: "No. Everything works in any modern browser on the phone or computer. There is nothing to install, and we train your team before you go live.",
  },
  {
    q: "Is our school data safe?",
    a: "Yes. Data is encrypted in transit and at rest, access is controlled role by role, and your data is backed up continuously and stored per school tenant.",
  },
  {
    q: "How long does setup take?",
    a: "Most schools go live in one to two weeks. Our onboarding team walks your admin through school setup, student registration and parent activation.",
  },
  {
    q: "Does it support online fee payment?",
    a: "Yes. You can collect fees online through payment gateways with UPI, cards and net banking, and parents get receipts instantly in the app.",
  },
];

const FOOTER_PLATFORM = ["Admissions & Fees", "Attendance", "Exams & Results", "Library & Books", "Transport"];
const FOOTER_COMPANY = ["About us", "Careers", "Partners", "Help centre", "Privacy policy"];
const TRUST_POINTS = ["Live in 1–2 weeks", "No credit card needed", "Encrypted & backed up"];

const initialsOf = (name) =>
  name
    .split(" ")
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();

/* ───────────────────────────────────────────────────────────────────────────
   Hooks & primitives
   ─────────────────────────────────────────────────────────────────────────── */
function useReveal() {
  useEffect(() => {
    const elements = Array.from(document.querySelectorAll("[data-reveal]"));
    if (!("IntersectionObserver" in window)) {
      elements.forEach((el) => el.classList.add("is-revealed"));
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-revealed");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12 },
    );
    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);
}

function Stars() {
  return (
    <div className="flex items-center gap-0.5" aria-label="5 star rating">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} size={15} className="fill-warning text-warning" />
      ))}
    </div>
  );
}

function SectionHeading({ eyebrow, title, description }) {
  return (
    <div data-reveal className="mx-auto max-w-2xl text-center">
      <span className="inline-flex items-center gap-2 rounded-chip border border-primary-border bg-primary-light px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] text-primary">
        <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-primary" />
        {eyebrow}
      </span>
      <h2 className="mt-5 font-display text-3xl font-bold tracking-tight sm:text-4xl lg:text-[42px] lg:leading-[1.08]">
        {title}
      </h2>
      {description && (
        <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-slate-text">{description}</p>
      )}
    </div>
  );
}

/* ───────────────────────────────────────────────────────────────────────────
   Sections
   ─────────────────────────────────────────────────────────────────────────── */
function Header({ scrolled, menuOpen, setMenuOpen }) {
  return (
    <header
      className={`sticky top-0 z-50 backdrop-blur-xl transition-all duration-300 ${
        scrolled
          ? "border-b border-line bg-paper/90 shadow-elev-1"
          : "border-b border-transparent bg-paper/70"
      }`}
    >
      <div className={SHELL}>
        <div className="flex h-16 items-center justify-between gap-4 lg:h-[72px]">
          <a href="#top" className={`flex items-center gap-2.5 ${focusRing} rounded-control`} aria-label="Zipschool OS — back to top">
            <img src="/ZipschoolOS-Transparent-logo.png" alt="Zipschool OS logo" className="h-9 w-auto lg:h-10" />
            <span className="font-display text-lg font-bold tracking-tight">
              Zipschool<span className="text-primary"> OS</span>
            </span>
          </a>

          <nav className="hidden items-center gap-7 lg:flex" aria-label="Primary">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className={`group relative rounded-sm text-sm font-medium text-slate-text transition-colors hover:text-ink ${focusRing}`}
              >
                {link.label}
                <span
                  aria-hidden
                  className="absolute -bottom-1.5 left-0 h-[2px] w-0 rounded-full bg-primary transition-all duration-300 group-hover:w-full"
                />
              </a>
            ))}
            <div className="ml-2 flex items-center gap-2.5">
              <Link
                to="/login"
                className={`rounded-control border border-line bg-white px-4 py-2.5 text-sm font-semibold text-ink transition duration-200 hover:-translate-y-0.5 hover:border-primary-border hover:text-primary hover:shadow-elev-2 ${focusRing}`}
              >
                Login
              </Link>
              <a
                href="#contact"
                className={`group inline-flex items-center gap-2 rounded-control bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-lift transition duration-200 hover:-translate-y-0.5 hover:bg-primary-dark hover:shadow-elev-3 ${focusRing}`}
              >
                Book a demo
                <ArrowRight size={15} className="transition-transform duration-200 group-hover:translate-x-0.5" />
              </a>
            </div>
          </nav>

          <button
            type="button"
            aria-label="Toggle navigation menu"
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
            onClick={() => setMenuOpen((open) => !open)}
            className={`rounded-control border border-line bg-white p-2 text-ink transition hover:border-primary-border hover:text-primary lg:hidden ${focusRing}`}
          >
            {menuOpen ? <X size={19} /> : <Menu size={19} />}
          </button>
        </div>
      </div>

      {menuOpen && (
        <div id="mobile-menu" className="animate-slide-in border-t border-line bg-paper/95 shadow-elev-3 backdrop-blur-xl lg:hidden">
          <nav className={`${SHELL} py-4`} aria-label="Mobile">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className="flex items-center justify-between rounded-control px-3 py-3 text-sm font-medium text-slate-text transition hover:bg-primary-light hover:text-primary"
              >
                {link.label}
                <ChevronRight size={16} className="text-slate-400" />
              </a>
            ))}
            <div className="mt-3 flex items-center gap-3 border-t border-line pt-4">
              <Link
                to="/login"
                onClick={() => setMenuOpen(false)}
                className={`flex-1 rounded-control border border-line bg-white px-4 py-3 text-center text-sm font-semibold text-ink transition hover:border-primary-border hover:text-primary ${focusRing}`}
              >
                Login
              </Link>
              <a
                href="#contact"
                onClick={() => setMenuOpen(false)}
                className={`flex-1 rounded-control bg-primary px-4 py-3 text-center text-sm font-semibold text-white shadow-lift transition hover:bg-primary-dark ${focusRing}`}
              >
                Book a demo
              </a>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}

function Hero({ active, paused, reducedMotion, goTo, setPaused, onKeyDown, onTouchStart, onTouchEnd }) {
  return (
    <section className="relative isolate overflow-hidden bg-navy" aria-label="Zipschool OS introduction">
      {/* Ambient depth: glows + a masked grid so the navy never reads flat */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -left-40 -top-48 h-[460px] w-[460px] rounded-full bg-primary/35 blur-[130px]" />
        <div className="absolute -bottom-48 right-[-10%] h-[420px] w-[420px] rounded-full bg-[#1D4ED8]/25 blur-[130px]" />
        <div className="absolute inset-0 opacity-70 [background-image:linear-gradient(rgba(255,255,255,0.07)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.07)_1px,transparent_1px)] [background-size:64px_64px] [mask-image:radial-gradient(ellipse_at_top_left,black,transparent_68%)]" />
      </div>

      <div
        role="region"
        aria-roledescription="carousel"
        aria-label="Product highlights"
        tabIndex={0}
        onKeyDown={onKeyDown}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onFocus={() => setPaused(true)}
        onBlur={() => setPaused(false)}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        className={`relative ${focusRing}`}
      >
        <div
          className="flex h-[620px] w-full transition-transform duration-[900ms] ease-[cubic-bezier(0.22,0.61,0.36,1)] sm:h-[660px] lg:h-[720px]"
          style={{ transform: `translateX(-${active * 100}%)` }}
        >
          {SLIDES.map((slide, i) => (
            <div
              key={slide.title}
              role="group"
              aria-roledescription="slide"
              aria-label={`${i + 1} of ${SLIDES.length}`}
              className="relative h-full w-full shrink-0"
            >
              <img
                src={slide.image}
                alt={slide.title}
                loading={i === 0 ? "eager" : "lazy"}
                decoding="async"
                className={`absolute inset-0 h-full w-full object-cover ${active === i ? "animate-kenburns" : ""}`}
              />
              {/* Layered scrims: side wash for type contrast, bottom fade into the page */}
              <div aria-hidden className="absolute inset-0 bg-gradient-to-r from-navy via-navy/88 to-navy/25" />
              <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-navy via-navy/35 to-navy/45" />
              <div
                aria-hidden
                className="absolute inset-0 bg-gradient-to-br from-primary/35 via-transparent to-transparent opacity-80 mix-blend-screen"
              />

              <div className="relative flex h-full items-center">
                <div className={`${SHELL} w-full`}>
                  <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_330px]">
                    <div className="py-16 pb-28 sm:py-20 sm:pb-28 lg:py-24">
                      {active === i && (
                        <div className="max-w-2xl" aria-live="polite">
                          <span
                            className={`animate-slide-in inline-flex items-center gap-2 rounded-chip border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold text-[#DCE7FF] backdrop-blur-md ${focusRing}`}
                          >
                            <GraduationCap size={14} />
                            {slide.badge}
                          </span>

                          <h1 className="animate-slide-in animate-slide-in-delay mt-6 font-display text-[34px] font-bold leading-[1.06] tracking-tight text-[#F8FAFC] sm:text-5xl lg:text-[58px]">
                            {slide.title}
                          </h1>

                          <p className={`animate-slide-in animate-slide-in-delay-2 mt-6 max-w-xl text-base leading-relaxed ${ON_DARK_SOFT} lg:text-lg`}>
                            {slide.sub}
                          </p>

                          <div className="animate-slide-in animate-slide-in-delay mt-9 flex flex-wrap items-center gap-3">
                            <a
                              href="#contact"
                              className={`group inline-flex items-center gap-2 rounded-control bg-primary px-6 py-3.5 text-sm font-semibold text-white shadow-lift transition duration-200 hover:-translate-y-1 hover:bg-primary-dark hover:shadow-elev-3 ${focusRing}`}
                            >
                              Book a free demo
                              <ArrowRight size={16} className="transition-transform duration-200 group-hover:translate-x-1" />
                            </a>
                            <a
                              href="#features"
                              className={`inline-flex items-center gap-2 rounded-control border border-white/25 bg-white/10 px-6 py-3.5 text-sm font-semibold text-[#F1F5F9] backdrop-blur-md transition duration-200 hover:-translate-y-1 hover:border-white/40 hover:bg-white/20 ${focusRing}`}
                            >
                              Explore features
                            </a>
                          </div>

                          <ul className="animate-slide-in animate-slide-in-delay-2 mt-9 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm">
                            {HERO_POINTS.map((point) => (
                              <li key={point} className="inline-flex items-center gap-2">
                                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-success/20">
                                  <CheckCircle2 size={13} className="text-[#4ADE80]" />
                                </span>
                                <span className={ON_DARK_SOFT}>{point}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>

                    {/* Glass jump panel — desktop only, purely navigational */}
                    {active === i && (
                      <aside
                        className="animate-slide-in animate-slide-in-delay-2 hidden rounded-panel border border-white/15 bg-white/[0.07] p-5 shadow-elev-3 backdrop-blur-xl lg:block"
                        aria-label="Quick links"
                      >
                        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#F1F5F9]/50">
                          Jump to
                        </p>
                        <ul className="mt-4 space-y-1.5">
                          {HERO_JUMPS.map((jump) => (
                            <li key={jump.href}>
                              <a
                                href={jump.href}
                                className={`group flex items-center gap-3 rounded-control border border-transparent px-3 py-2.5 text-sm font-medium text-[#F1F5F9]/85 transition duration-200 hover:border-white/15 hover:bg-white/10 ${focusRing}`}
                              >
                                <span className="flex h-8 w-8 items-center justify-center rounded-chip bg-white/10 text-[#DCE7FF] transition group-hover:bg-primary">
                                  <jump.icon size={15} />
                                </span>
                                {jump.label}
                                <ChevronRight size={15} className="ml-auto opacity-0 transition group-hover:translate-x-0.5 group-hover:opacity-70" />
                              </a>
                            </li>
                          ))}
                        </ul>
                        <div className="mt-5 flex items-center gap-2.5 rounded-control border border-white/15 bg-navy/40 px-3 py-2.5">
                          <span aria-hidden className="relative flex h-2 w-2">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#4ADE80] opacity-75" />
                            <span className="relative inline-flex h-2 w-2 rounded-full bg-[#4ADE80]" />
                          </span>
                          <p className="text-xs text-[#F1F5F9]/80">Onboarding slots open this week</p>
                        </div>
                      </aside>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Progress rail + arrows */}
        <div className="absolute inset-x-0 bottom-0 z-20">
          <div className={`${SHELL} flex flex-wrap items-end justify-between gap-x-4 gap-y-3 pb-6 sm:pb-8`}>
            <div className="flex min-w-0 items-center gap-3 sm:gap-4">
              <p className="hidden font-display text-xs font-bold tabular-nums tracking-wide text-[#F1F5F9] sm:block">
                {String(active + 1).padStart(2, "0")}
                <span className="text-[#F1F5F9]/35"> / {String(SLIDES.length).padStart(2, "0")}</span>
              </p>
              <div className="flex items-center gap-1.5 sm:gap-2" role="tablist" aria-label="Choose slide">
                {SLIDES.map((slide, i) => {
                  const isActive = active === i;
                  return (
                    <button
                      key={slide.title}
                      type="button"
                      role="tab"
                      aria-selected={isActive}
                      aria-label={`Go to slide ${i + 1}`}
                      onClick={() => goTo(i)}
                      className={`group/dot h-8 w-7 sm:w-14 ${focusRing} rounded-full`}
                    >
                      <span
                        aria-hidden
                        className={`block h-1 overflow-hidden rounded-full transition-colors duration-300 ${
                          isActive ? "bg-white/25" : "bg-white/25 group-hover/dot:bg-white/50"
                        }`}
                      >
                        {isActive && (
                          <span
                            key={active}
                            className={`block h-full rounded-full bg-white ${
                              reducedMotion ? "w-full" : "animate-progress-fill"
                            } ${paused && !reducedMotion ? "progress-paused" : ""}`}
                          />
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 p-1 backdrop-blur-md sm:gap-2 sm:p-1.5">
              <button
                type="button"
                aria-label="Previous slide"
                onClick={() => goTo(active - 1)}
                className={`rounded-full p-2.5 text-[#F1F5F9] transition duration-200 hover:bg-white/25 active:bg-white/30 ${focusRing}`}
              >
                <ChevronLeft size={19} />
              </button>
              <button
                type="button"
                aria-label="Next slide"
                onClick={() => goTo(active + 1)}
                className={`rounded-full p-2.5 text-[#F1F5F9] transition duration-200 hover:bg-white/25 active:bg-white/30 ${focusRing}`}
              >
                <ChevronRight size={19} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function StatsBar() {
  return (
    <div className="relative z-30 -mt-14 sm:-mt-16">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-y-10 rounded-panel border border-line bg-white px-5 py-9 shadow-elev-3 sm:px-8 lg:grid-cols-4 lg:gap-y-0 lg:divide-x lg:divide-line">
          {STATS.map((stat, i) => (
            <div
              key={stat.label}
              data-reveal
              style={stagger(i, 80)}
              className="flex items-center gap-3.5 px-1 lg:justify-center lg:px-6"
            >
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-control bg-primary-light text-primary">
                <stat.icon size={21} />
              </span>
              <div className="min-w-0">
                <p className="font-display text-2xl font-bold leading-none tabular-nums tracking-tight lg:text-[28px]">
                  {stat.value}
                </p>
                <p className="mt-1.5 text-xs leading-snug text-slate-text">{stat.label}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Features() {
  return (
    <section id="features" className={`${SHELL} scroll-mt-24 pt-32 sm:pt-36 ${BAND}`}>
      <SectionHeading
        eyebrow="Everything you need"
        title="One platform. Every module a school runs on."
        description="Stop juggling registers, spreadsheets, WhatsApp groups and payment apps. Zipschool OS brings the whole school day into one place."
      />

      <div className="mt-14 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((feature, i) => (
          <article
            key={feature.title}
            data-reveal
            style={stagger(i, 55)}
            className="group relative overflow-hidden rounded-card border border-line bg-white p-6 shadow-elev-1 transition-all duration-300 hover:-translate-y-1.5 hover:border-primary-border hover:shadow-elev-3"
          >
            <span
              aria-hidden
              className="absolute inset-x-0 top-0 h-[3px] origin-left scale-x-0 bg-gradient-to-r from-primary to-primary-dark transition-transform duration-300 group-hover:scale-x-100"
            />
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 bg-gradient-to-b from-primary/[0.05] to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100"
            />

            <div className="relative">
              <span
                className={`flex h-11 w-11 items-center justify-center rounded-control shadow-elev-1 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:scale-105 ${feature.tile}`}
              >
                <feature.icon size={20} />
              </span>
              <h3 className="mt-5 font-display text-lg font-semibold tracking-tight">{feature.title}</h3>
              <p className="mt-2.5 text-sm leading-relaxed text-slate-text">{feature.desc}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function Roles() {
  return (
    <section id="roles" className={`scroll-mt-24 border-y border-line bg-white ${BAND}`}>
      <div className={SHELL}>
        <SectionHeading
          eyebrow="Built for every role"
          title="The whole school, connected"
          description="Each role gets its own workspace — so everyone sees what they need and nothing they don't."
        />

        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {ROLES.map((role, i) => (
            <article
              key={role.title}
              data-reveal
              style={stagger(i, 70)}
              className={`group relative flex flex-col overflow-hidden rounded-card border border-line bg-gradient-to-b ${role.wash} to-white p-6 shadow-elev-1 transition-all duration-300 hover:-translate-y-1.5 hover:shadow-elev-3`}
            >
              <span
                aria-hidden
                className={`absolute inset-x-0 top-0 h-1 origin-left scale-x-0 transition-transform duration-300 group-hover:scale-x-100 ${role.bar}`}
              />
              <span className={`flex h-12 w-12 items-center justify-center rounded-control shadow-elev-1 ${role.tile}`}>
                <role.icon size={22} />
              </span>
              <h3 className="mt-5 font-display text-lg font-semibold tracking-tight">{role.title}</h3>
              <ul className="mt-4 space-y-2.5">
                {role.points.map((point) => (
                  <li key={point} className="flex items-start gap-2.5 text-sm leading-snug text-slate-text">
                    <CheckCircle2 size={15} className={`mt-0.5 shrink-0 ${role.check}`} />
                    {point}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function Steps() {
  return (
    <section id="steps" className={`${SHELL} scroll-mt-24 ${BAND}`}>
      <SectionHeading
        eyebrow="Up and running fast"
        title="Live in a week, not a term"
        description="Our onboarding team does the heavy lifting so your staff only have to start using it."
      />

      <div className="mt-16 grid gap-5 md:grid-cols-3">
        {STEPS.map((step, i) => (
          <div
            key={step.step}
            data-reveal
            style={stagger(i, 90)}
            className="group relative rounded-card border border-line bg-white p-6 pt-9 shadow-elev-1 transition-all duration-300 hover:-translate-y-1.5 hover:border-primary-border hover:shadow-elev-3"
          >
            {/* Connector sits on the badge axis, bridging the grid gap on desktop */}
            {i < STEPS.length - 1 && (
              <span
                aria-hidden
                className="absolute -right-5 top-6 hidden h-px w-5 border-t border-dashed border-line lg:block"
              />
            )}
            <span
              aria-hidden
              className="absolute -top-6 left-6 flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary-dark font-display text-base font-bold tabular-nums text-white shadow-lift ring-4 ring-paper transition-transform duration-300 group-hover:scale-105"
            >
              {step.step}
            </span>

            <span className="flex h-11 w-11 items-center justify-center rounded-control bg-primary-light text-primary">
              <step.icon size={20} />
            </span>
            <h3 className="mt-5 font-display text-lg font-semibold tracking-tight">{step.title}</h3>
            <p className="mt-2.5 text-sm leading-relaxed text-slate-text">{step.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function Testimonials() {
  return (
    <section id="testimonials" className={`scroll-mt-24 border-y border-line bg-white ${BAND}`}>
      <div className={SHELL}>
        <SectionHeading eyebrow="Loved by schools" title="What schools say about Zipschool OS" />

        <div className="mt-14 grid gap-5 lg:grid-cols-3">
          {TESTIMONIALS.map((testimonial, i) => (
            <figure
              key={testimonial.name}
              data-reveal
              style={stagger(i, 80)}
              className="group relative flex flex-col justify-between overflow-hidden rounded-panel border border-line bg-white p-7 shadow-elev-1 transition-all duration-300 hover:-translate-y-1.5 hover:border-primary-border hover:shadow-elev-3"
            >
              <span
                aria-hidden
                className="absolute inset-x-0 top-0 h-[3px] origin-left scale-x-0 bg-gradient-to-r from-primary to-primary-dark transition-transform duration-300 group-hover:scale-x-100"
              />
              <Quote
                aria-hidden
                size={88}
                className="pointer-events-none absolute -right-3 -top-4 text-primary/[0.07] transition-transform duration-500 group-hover:-translate-y-1"
              />

              <div className="relative">
                <Stars />
                <blockquote className="mt-4 text-[15px] leading-relaxed text-ink/85">
                  &ldquo;{testimonial.quote}&rdquo;
                </blockquote>
              </div>

              <figcaption className="relative mt-7 flex items-center gap-3.5 border-t border-line pt-6">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary-dark font-display text-xs font-bold text-white shadow-elev-2">
                  {initialsOf(testimonial.name)}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-ink">{testimonial.name}</p>
                  <p className="text-xs text-slate-text">{testimonial.role}</p>
                  <p className="truncate text-xs text-slate-text/80">{testimonial.school}</p>
                </div>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}

function Faq({ openFaq, setOpenFaq }) {
  return (
    <section id="faq" className={`mx-auto w-full max-w-4xl scroll-mt-24 px-4 sm:px-6 lg:px-12 ${BAND}`}>
      <SectionHeading eyebrow="Questions" title="Frequently asked questions" />

      <div className="mt-12 space-y-3">
        {FAQS.map((faq, i) => {
          const isOpen = openFaq === i;
          const panelId = `faq-panel-${i}`;
          const buttonId = `faq-button-${i}`;
          return (
            <div
              key={faq.q}
              data-reveal
              style={stagger(i, 45)}
              className={`overflow-hidden rounded-panel border bg-white transition-all duration-300 ${
                isOpen
                  ? "border-primary-border shadow-elev-2"
                  : "border-line shadow-elev-1 hover:border-primary-border/70 hover:shadow-elev-2"
              }`}
            >
              <h3>
                <button
                  id={buttonId}
                  type="button"
                  aria-expanded={isOpen}
                  aria-controls={panelId}
                  onClick={() => setOpenFaq(isOpen ? -1 : i)}
                  className={`group flex w-full items-center gap-4 px-5 py-5 text-left transition-colors duration-200 hover:bg-primary-light/40 sm:px-6 ${focusRing}`}
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-light font-display text-xs font-bold tabular-nums text-primary transition duration-200 group-hover:bg-primary group-hover:text-white">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="flex-1 text-[15px] font-semibold tracking-tight text-ink">{faq.q}</span>
                  <span
                    aria-hidden
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition-all duration-300 ${
                      isOpen
                        ? "rotate-180 border-primary bg-primary text-white"
                        : "border-line bg-paper text-primary group-hover:border-primary-border group-hover:bg-primary-light"
                    }`}
                  >
                    <ChevronDown size={16} />
                  </span>
                </button>
              </h3>
              <div
                id={panelId}
                role="region"
                aria-labelledby={buttonId}
                className={`grid transition-all duration-300 ease-out ${
                  isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                }`}
              >
                <div className="overflow-hidden">
                  <p className="px-5 pb-6 pl-[68px] text-sm leading-relaxed text-slate-text sm:px-6 sm:pl-[76px]">
                    {faq.a}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div
        data-reveal
        className="mt-10 flex flex-col items-center justify-between gap-5 rounded-panel border border-line bg-white p-6 text-center shadow-elev-1 sm:flex-row sm:text-left"
      >
        <div className="flex items-center gap-3.5">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-control bg-primary-light text-primary">
            <Phone size={18} />
          </span>
          <div>
            <p className="font-display text-base font-semibold tracking-tight">Still have a question?</p>
            <p className="text-sm text-slate-text">Call us toll-free — we reply within a working day.</p>
          </div>
        </div>
        <a
          href="#contact"
          className={`group inline-flex shrink-0 items-center gap-2 rounded-control bg-primary px-5 py-3 text-sm font-semibold text-white shadow-lift transition duration-200 hover:-translate-y-0.5 hover:bg-primary-dark hover:shadow-elev-3 ${focusRing}`}
        >
          Book a demo
          <ArrowRight size={16} className="transition-transform duration-200 group-hover:translate-x-0.5" />
        </a>
      </div>
    </section>
  );
}

function Contact({ form, update, handleSubmit, sent, setSent }) {
  return (
    <section id="contact" className={`${SHELL} scroll-mt-24 pb-20 sm:pb-24 lg:pb-28`}>
      <div
        data-reveal
        className="mx-auto grid max-w-6xl overflow-hidden rounded-hero bg-navy shadow-elev-3 lg:grid-cols-[0.95fr_1.05fr]"
      >
        {/* Value panel */}
        <div className="relative isolate flex flex-col justify-between gap-10 overflow-hidden bg-gradient-to-br from-[#0C47CF] via-[#0A39A3] to-navy p-8 lg:p-12">
          <div aria-hidden className="pointer-events-none absolute inset-0">
            <div className="absolute -left-20 -top-24 h-72 w-72 rounded-full bg-white/15 blur-3xl" />
            <div className="absolute -bottom-28 -right-16 h-72 w-72 rounded-full bg-[#1D4ED8]/40 blur-3xl" />
            <div className="absolute inset-0 opacity-60 [background-image:linear-gradient(rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.08)_1px,transparent_1px)] [background-size:48px_48px] [mask-image:radial-gradient(ellipse_at_bottom_right,black,transparent_70%)]" />
          </div>

          <div className="relative">
            <span className="inline-flex items-center gap-2 rounded-chip border border-white/20 bg-white/15 px-3 py-1.5 text-xs font-semibold text-[#F1F5F9] backdrop-blur-md">
              <Phone size={13} />
              Free guided onboarding
            </span>
            <h2 className="mt-6 font-display text-3xl font-bold leading-tight tracking-tight text-[#F8FAFC] sm:text-4xl">
              Ready to take your school online?
            </h2>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-[#F1F5F9]/80">
              Talk to us or book a demo. We'll show you your school's setup live — there's no
              obligation, and no credit card.
            </p>

            <ul className="mt-8 flex flex-wrap gap-2">
              {TRUST_POINTS.map((point) => (
                <li
                  key={point}
                  className="inline-flex items-center gap-1.5 rounded-chip border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-medium text-[#F1F5F9]/90 backdrop-blur-md"
                >
                  <CheckCircle2 size={13} className="text-[#4ADE80]" />
                  {point}
                </li>
              ))}
            </ul>
          </div>

          <div className="relative space-y-2.5">
            <a
              href="mailto:sales@zipschoolos.com"
              className={`flex items-center gap-3 rounded-control border border-white/15 bg-white/10 px-4 py-3 text-sm text-[#F1F5F9]/90 backdrop-blur-md transition duration-200 hover:-translate-y-0.5 hover:bg-white/20 ${focusRing}`}
            >
              <Mail size={16} className="shrink-0 text-white/70" />
              sales@zipschoolos.com
            </a>
            <a
              href="tel:18000000000"
              className={`flex items-center gap-3 rounded-control border border-white/15 bg-white/10 px-4 py-3 text-sm text-[#F1F5F9]/90 backdrop-blur-md transition duration-200 hover:-translate-y-0.5 hover:bg-white/20 ${focusRing}`}
            >
              <Phone size={16} className="shrink-0 text-white/70" />
              1800 000 0000 (toll-free)
            </a>
            <p className="flex items-center gap-3 px-4 py-2 text-sm text-[#F1F5F9]/80">
              <MapPin size={16} className="shrink-0 text-white/70" />
              Serving schools across India
            </p>
          </div>
        </div>

        {/* Form panel */}
        <div className="bg-white p-6 sm:p-8 lg:p-10">
          {sent ? (
            <div className="flex h-full flex-col items-center justify-center gap-4 rounded-panel border border-success/30 bg-success-light p-8 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-success text-white shadow-lift">
                <CheckCircle2 size={28} />
              </span>
              <h3 className="font-display text-xl font-bold tracking-tight text-ink">
                Thank you, {form.name || "friend"}!
              </h3>
              <p className="max-w-sm text-sm leading-relaxed text-slate-text">
                We've received your enquiry{form.school ? ` for ${form.school}` : ""}. Our team
                will reach out within a day to schedule your demo.
              </p>
              <button
                type="button"
                onClick={() => setSent(false)}
                className={`mt-2 rounded-control text-sm font-semibold text-primary underline-offset-4 hover:underline ${focusRing}`}
              >
                Send another enquiry
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <h3 className="font-display text-xl font-bold tracking-tight text-ink">Book your free demo</h3>
                <p className="mt-1.5 text-sm text-slate-text">Five quick fields — that's it.</p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label htmlFor="contact-school" className="mb-1.5 block text-xs font-semibold text-ink">
                    School name
                  </label>
                  <input
                    id="contact-school"
                    name="school"
                    autoComplete="organization"
                    required
                    value={form.school}
                    onChange={update("school")}
                    placeholder="e.g. Green Valley Public School"
                    className={fieldClass}
                  />
                </div>
                <div>
                  <label htmlFor="contact-name" className="mb-1.5 block text-xs font-semibold text-ink">
                    Your name
                  </label>
                  <input
                    id="contact-name"
                    name="name"
                    autoComplete="name"
                    required
                    value={form.name}
                    onChange={update("name")}
                    placeholder="Full name"
                    className={fieldClass}
                  />
                </div>
                <div>
                  <label htmlFor="contact-phone" className="mb-1.5 block text-xs font-semibold text-ink">
                    Phone / WhatsApp
                  </label>
                  <input
                    id="contact-phone"
                    name="phone"
                    type="tel"
                    autoComplete="tel"
                    required
                    value={form.phone}
                    onChange={update("phone")}
                    placeholder="10-digit mobile number"
                    className={fieldClass}
                  />
                </div>
                <div>
                  <label htmlFor="contact-city" className="mb-1.5 block text-xs font-semibold text-ink">
                    City
                  </label>
                  <input
                    id="contact-city"
                    name="city"
                    autoComplete="address-level2"
                    value={form.city}
                    onChange={update("city")}
                    placeholder="Your city"
                    className={fieldClass}
                  />
                </div>
                <div>
                  <label htmlFor="contact-message" className="mb-1.5 block text-xs font-semibold text-ink">
                    Anything else?
                  </label>
                  <textarea
                    id="contact-message"
                    name="message"
                    rows={3}
                    value={form.message}
                    onChange={update("message")}
                    placeholder="Tell us about your school or what you'd like to automate"
                    className={`${fieldClass} resize-none`}
                  />
                </div>
              </div>

              <button
                type="submit"
                className={`group inline-flex w-full items-center justify-center gap-2 rounded-control bg-gradient-to-r from-primary to-primary-dark px-6 py-3.5 text-sm font-semibold text-white shadow-lift transition duration-200 hover:-translate-y-0.5 hover:shadow-elev-3 ${focusRing}`}
              >
                Request a demo
                <Send size={15} className="transition-transform duration-200 group-hover:translate-x-0.5" />
              </button>

              <p className="flex items-center justify-center gap-1.5 text-center text-xs text-slate-text">
                <ShieldCheck size={14} className="shrink-0 text-success" />
                No spam, ever. We only reply about your school.
              </p>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-line bg-ink-dark">
      <div aria-hidden className="h-px w-full bg-gradient-to-r from-transparent via-primary/60 to-transparent" />
      <div className={`${SHELL} py-14 text-[#94A3B8]`}>
        <div className="grid gap-12 lg:grid-cols-[1.5fr_1fr_1fr_1.2fr]">
          <div>
            <div className="flex items-center gap-2.5">
              <img
                src="/ZipschoolOS-Transparent-logo.png"
                alt="Zipschool OS logo"
                className="h-9 w-auto invert"
                loading="lazy"
              />
              <span className="font-display text-lg font-bold text-[#F1F5F9]">
                Zipschool<span className="text-primary-light"> OS</span>
              </span>
            </div>
            <p className="mt-4 max-w-xs text-sm leading-relaxed">
              School operations, connected. One platform that runs admissions, academics, fees,
              transport and parent communication.
            </p>
            <ul className="mt-6 flex flex-wrap gap-2">
              {["Nursery to Class 12", "Single branch to chain", "UPI, cards & net banking"].map((chip) => (
                <li
                  key={chip}
                  className="rounded-chip border border-white/10 bg-white/[0.06] px-2.5 py-1 text-xs text-[#CBD5E1]"
                >
                  {chip}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-bold uppercase tracking-[0.14em] text-[#F1F5F9]/70">Platform</h4>
            <ul className="mt-5 space-y-3 text-sm">
              {FOOTER_PLATFORM.map((item) => (
                <li key={item}>
                  <a href="#features" className="group inline-flex items-center gap-1.5 transition-colors hover:text-white">
                    {item}
                    <ChevronRight size={13} className="-translate-x-1 opacity-0 transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-60" />
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-bold uppercase tracking-[0.14em] text-[#F1F5F9]/70">Company</h4>
            <ul className="mt-5 space-y-3 text-sm">
              {FOOTER_COMPANY.map((item) => (
                <li key={item}>
                  <a href="#top" className="group inline-flex items-center gap-1.5 transition-colors hover:text-white">
                    {item}
                    <ChevronRight size={13} className="-translate-x-1 opacity-0 transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-60" />
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-panel border border-white/10 bg-white/[0.05] p-6">
            <h4 className="font-display text-base font-bold text-[#F1F5F9]">Get started</h4>
            <p className="mt-2 text-sm leading-relaxed">
              New here? Visit the login page to access your school workspace.
            </p>
            <Link
              to="/login"
              className={`group mt-5 inline-flex items-center gap-2 rounded-control bg-white px-5 py-3 text-sm font-semibold text-ink transition duration-200 hover:-translate-y-0.5 hover:bg-white/90 hover:shadow-elev-2 ${focusRing}`}
            >
              Login to your school
              <ArrowRight size={15} className="transition-transform duration-200 group-hover:translate-x-0.5" />
            </Link>
            <p className="mt-5 flex items-center gap-2 border-t border-white/10 pt-4 text-xs text-[#CBD5E1]">
              <ShieldCheck size={14} className="shrink-0 text-[#4ADE80]" />
              Encrypted, backed up, role-controlled
            </p>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-3 border-t border-white/10 pt-6 text-xs sm:flex-row">
          <p>&copy; {new Date().getFullYear()} Zipschool OS. All rights reserved.</p>
          <p>Made with care for schools across India</p>
        </div>
      </div>
    </footer>
  );
}

/* ───────────────────────────────────────────────────────────────────────────
   Page
   ─────────────────────────────────────────────────────────────────────────── */
export default function Landing() {
  useReveal();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState(0);
  const [form, setForm] = useState({
    school: "",
    name: "",
    phone: "",
    city: "",
    message: "",
  });
  const [sent, setSent] = useState(false);
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reducedMotion] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const touchX = useRef(0);

  const goTo = (index) => setActive((index + SLIDES.length) % SLIDES.length);

  useEffect(() => {
    if (paused || reducedMotion) return undefined;
    const id = setInterval(() => setActive((index) => (index + 1) % SLIDES.length), 3000);
    return () => clearInterval(id);
  }, [paused, reducedMotion, active]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const onKey = (event) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  const update = (key) => (event) =>
    setForm((prev) => ({ ...prev, [key]: event.target.value }));

  const handleSubmit = (event) => {
    event.preventDefault();
    setSent(true);
  };

  const onHeroKeyDown = (event) => {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      setPaused(true);
      goTo(active - 1);
    }
    if (event.key === "ArrowRight") {
      event.preventDefault();
      setPaused(true);
      goTo(active + 1);
    }
  };

  const onHeroTouchStart = (event) => {
    touchX.current = event.touches[0].clientX;
  };

  const onHeroTouchEnd = (event) => {
    const delta = event.changedTouches[0].clientX - touchX.current;
    if (Math.abs(delta) > 48) {
      goTo(active + (delta > 0 ? -1 : 1));
    }
  };

  return (
    <div className="min-h-screen bg-paper font-body text-ink antialiased selection:bg-primary/20 scroll-smooth">
      <a
        href="#top"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-control focus:bg-primary focus:px-4 focus:py-2.5 focus:text-sm focus:font-semibold focus:text-white focus:shadow-elev-3"
      >
        Skip to main content
      </a>

      <Header scrolled={scrolled} menuOpen={menuOpen} setMenuOpen={setMenuOpen} />

      <main id="top">
        <Hero
          active={active}
          paused={paused}
          reducedMotion={reducedMotion}
          goTo={goTo}
          setPaused={setPaused}
          onKeyDown={onHeroKeyDown}
          onTouchStart={onHeroTouchStart}
          onTouchEnd={onHeroTouchEnd}
        />

        <StatsBar />
        <Features />
        <Roles />
        <Steps />
        <Testimonials />
        <Faq openFaq={openFaq} setOpenFaq={setOpenFaq} />
        <Contact form={form} update={update} handleSubmit={handleSubmit} sent={sent} setSent={setSent} />
      </main>

      <Footer />
    </div>
  );
}
