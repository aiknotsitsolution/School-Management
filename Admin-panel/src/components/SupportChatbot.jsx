import { useEffect, useRef, useState } from "react";
import { Bot, Headset, Send, X } from "lucide-react";

const FAQS = [
  {
    keys: ["hi", "hello", "hey", "namaste", "good morning", "good afternoon", "good evening", "salaam"],
    reply:
      "Hi! 👋 I'm the Zipschool OS support assistant. Ask me about fees, attendance, timetable, exams, results, library, transport or login issues — or type 'help' to reach a human.",
  },
  {
    keys: ["fee", "payment", "pay", "invoice", "receipt", "due", "installment"],
    reply:
      "Fees & payments:\n\n• Invoices are auto-generated per fee type + session and can be previewed in Fees Collection.\n• Payments can be collected offline (cash/cheque) or online through the payment gateway.\n• Receipts are issued instantly and available in Reports.\n\nFor a specific payment dispute, tap 'help' and a support agent will assist.",
  },
  {
    keys: ["attendance", "mark", "absent", "present"],
    reply:
      "Attendance:\n\n• Class teachers can mark daily attendance from the Attendance page.\n• Students/parents can view their attendance on the Student Dashboard.\n• Records can be exported for school records.\n\nFor bulk corrections reach out via 'help'.",
  },
  {
    keys: ["timetable", "period", "schedule", "class time"],
    reply:
      "Timetable:\n\n• Class-wise and section-wise timetables are maintained with time slots and subjects.\n• Teachers and students view their own timetable on their dashboards.\n• To edit periods, go to Timetable → 'Manage' per class.",
  },
  {
    keys: ["homework", "assignment", "submit"],
    reply:
      "Homework:\n\n• Teachers create homework with title, description and due date.\n• Students see assignments on their dashboard and can mark them done.\n• Deadlines can be edited before the due date.",
  },
  {
    keys: ["exam", "examination", "assessment", "test", "marks", "enter marks"],
    reply:
      "Examinations:\n\n• Define exam types, then enter marks per subject and per class.\n• Grading, ranks and class performance roll up automatically.\n• Results roll up to report cards once marks are finalised.",
  },
  {
    keys: ["result", "report card", "grades", "grade", "rank", "score"],
    reply:
      "Results & report cards:\n\n• Results are computed after marks are finalised for an exam.\n• Report cards are generated per session with grades and remarks.\n• Teachers can print class reports from Report Card.",
  },
  {
    keys: ["library", "book", "issue", "return", "overdue"],
    reply:
      "Library:\n\n• Books can be added with optional ISBN and managed by category.\n• Issues and returns are tracked per student; overdue items show up on the dashboard.\n• Students can check 'My Library' on their dashboard.",
  },
  {
    keys: ["transport", "bus", "route", "pickup", "drop"],
    reply:
      "Transport:\n\n• Bus routes and allocations are managed from the Transport page.\n• Students/parents can view their assigned bus and route.\n• Live bus tracking is available on the Transport dashboard.",
  },
  {
    keys: ["password", "login", "forgot", "credentials", "account"],
    reply:
      "Login & account:\n\n• Use the credentials issued by the school.\n• Forgot your password? Your school admin can reset it from Users & Access.\n• Still stuck? Tap 'help' for direct support.",
  },
  {
    keys: ["admission", "enquiry", "new student", "enroll", "enrol", "register student"],
    reply:
      "Admissions:\n\n• Enquiries are captured from the Reception dashboard.\n• Approved enquiries are converted into new student records.\n• Each new student gets login credentials automatically.",
  },
  {
    keys: ["help", "human", "agent", "call", "contact", "ticket", "support", "helpdesk", "ext", "issue", "problem"],
    reply:
      "Need a human? Reaching a support agent:\n\n• Call the IT helpdesk at ext. 204 (Mon–Sat, 9 AM – 6 PM).\n• Visit the admin support desk during office hours.\n• Or email support@brightwood.in with your school code and a short description.",
  },
  {
    keys: ["thank", "great", "nice", "cool", "ok", "okay", "bye"],
    reply:
      "You're welcome! Is there anything else I can help you with?",
  },
  {
    keys: ["default"],
    reply:
      "I'm not sure about that one yet. Try asking about Fees, Attendance, Timetable, Exams, Results, Library, Transport or Login — or tap 'help' and a support agent will take over.",
  },
];

const CHIPS = ["Fees", "Attendance", "Timetable", "Exams", "Results", "Library", "login issue", "help"];

const botReply = (text) => {
  const t = text.toLowerCase().trim();
  if (!t) return FAQS[FAQS.length - 1].reply;
  const match = FAQS.find((f) => f.keys.some((k) => t.includes(k)));
  return (match || FAQS[FAQS.length - 1]).reply;
};

export default function SupportChatbot() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [messages, setMessages] = useState([
    {
      from: "bot",
      text: "Hi! 👋 How can I help you today? Try tapping a topic below or type your question.",
    },
  ]);
  const scrollRef = useRef(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, typing, open]);

  const send = (raw) => {
    const text = (raw ?? input).trim();
    if (!text) return;
    setInput("");
    setMessages((m) => [...m, { from: "user", text }]);
    setTyping(true);
    setTimeout(() => {
      setMessages((m) => [...m, { from: "bot", text: botReply(text) }]);
      setTyping(false);
    }, 650);
  };

  return (
    <div className="fixed bottom-4 right-4 z-40 flex flex-col items-end gap-3">
      {open && (
        <div className="w-[calc(100vw-2rem)] max-w-[360px] h-[480px] max-h-[72vh] bg-white rounded-2xl shadow-2xl border border-ink/10 overflow-hidden flex flex-col">
          {/* Header */}
          <div className="bg-ink text-white px-4 py-3 flex items-center gap-3 shrink-0">
            <div className="w-10 h-10 rounded-full bg-amber/90 flex items-center justify-center">
              <Bot size={20} className="text-ink" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[14px] font-semibold leading-tight">Support Assistant</p>
              <p className="text-[11.5px] text-white/60 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-success inline-block" />
                Online · School Helpdesk
              </p>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-white/70 hover:text-white"
              aria-label="Close support chat"
            >
              <X size={18} />
            </button>
          </div>

          {/* Messages */}
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto scrollbar-hidden p-3 space-y-2.5 bg-paper"
          >
            {messages.map((msg, i) =>
              msg.from === "bot" ? (
                <div
                  key={i}
                  className="max-w-[88%] w-fit bg-white border border-ink/10 rounded-2xl rounded-tl-sm px-3 py-2 text-[13px] text-slate-text leading-relaxed whitespace-pre-line"
                >
                  {msg.text}
                </div>
              ) : (
                <div
                  key={i}
                  className="max-w-[88%] ml-auto w-fit bg-ink text-white rounded-2xl rounded-tr-sm px-3 py-2 text-[13px] leading-relaxed whitespace-pre-line"
                >
                  {msg.text}
                </div>
              ),
            )}
            {typing && (
              <div className="w-fit bg-white border border-ink/10 rounded-2xl rounded-tl-sm px-3.5 py-2.5 flex items-center gap-1">
                {[0, 1, 2].map((d) => (
                  <span
                    key={d}
                    className="w-1.5 h-1.5 rounded-full bg-slate-text/40 animate-bounce"
                    style={{ animationDelay: `${d * 120}ms` }}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Quick chips */}
          <div className="px-3 pt-2 flex gap-1.5 overflow-x-auto scrollbar-hidden shrink-0">
            {CHIPS.map((c) => (
              <button
                key={c}
                onClick={() => send(c)}
                className="shrink-0 px-2.5 py-1 rounded-full border border-ink/15 bg-white text-[12px] text-slate-text hover:border-ink/40 hover:text-ink transition-colors"
              >
                {c}
              </button>
            ))}
          </div>

          {/* Input */}
          <div className="p-3 shrink-0">
            <div className="flex items-center gap-2 bg-white border border-ink/15 rounded-xl px-3 py-2 focus-within:border-ink/50 transition-colors">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && send()}
                placeholder="Type your question…"
                className="flex-1 min-w-0 bg-transparent text-[13.5px] text-slate-text outline-none placeholder:text-slate-text/40"
              />
              <button
                onClick={() => send()}
                disabled={!input.trim()}
                className="p-1.5 rounded-lg bg-ink text-amber disabled:opacity-40 hover:opacity-90 transition-opacity"
                aria-label="Send message"
              >
                <Send size={15} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FAB */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative w-14 h-14 rounded-full bg-ink text-amber shadow-2xl hover:scale-105 active:scale-95 transition-transform flex items-center justify-center"
        aria-label="Open support chat"
        title="Support helpdesk"
      >
        <span className="absolute inset-0 rounded-full bg-ink/40 animate-ping" style={{ animationDuration: "2.5s" }} />
        <span className="relative">
          {open ? <X size={24} /> : <Headset size={24} />}
        </span>
      </button>
    </div>
  );
}