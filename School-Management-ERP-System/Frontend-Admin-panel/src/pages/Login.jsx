import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useDispatch } from "react-redux";
import { GraduationCap, ArrowRight, Lock, Mail } from "lucide-react";
import { api } from "../lib/api";
import { setCredentials } from "../store/authSlice";

const brand = {
  name: "School Management ERP",
  shortName: "School ERP",
  tagline: "School operations, connected",
  affiliation: "School Administration",
  session: String(new Date().getFullYear()),
};

const roleHome = {
  super_admin: "/platform",
  school_admin: "/",
  class_teacher: "/teacher-dashboard",
  teacher: "/teacher-dashboard",
  student: "/student-dashboard",
  staff: "/staff-dashboard",
};

export default function Login() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { data } = await api.login({ email: email.trim(), password });
      dispatch(
        setCredentials({
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
          user: data.user,
          school: data.school,
        }),
      );
      const target = (() => {
        if (data.user?.role === "staff" && data.user?.designation === "admission_counsellor") {
          return "/admission-counsellor";
        }
        return (
          roleHome[data.user?.role] ||
          (data.user?.role === "admin" || data.user?.role === "staff"
            ? "/"
            : "/student-dashboard")
        );
      })();
      navigate(target, { replace: true });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-paper">
      <div className="relative hidden lg:flex flex-col justify-between p-12 bg-ink text-white overflow-hidden">
        <img
          src="https://images.unsplash.com/photo-1580582932707-520aed937b7b?w=1200&h=1400&fit=crop"
          alt=""
          className="absolute inset-0 w-full h-full object-cover opacity-[0.18]"
        />
        <div className="relative z-10 flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-amber flex items-center justify-center text-ink">
            <GraduationCap size={24} strokeWidth={2.5} />
          </div>
          <div>
            <p className="font-display font-bold text-lg leading-tight">
              {brand.name}
            </p>
            <p className="text-white/50 text-[12.5px]">{brand.tagline}</p>
          </div>
        </div>
        <div className="relative z-10 max-w-md">
          <h2 className="font-display text-4xl font-bold leading-tight">
            One platform to run every part of the school day.
          </h2>
          <p className="text-white/60 mt-4 text-[14.5px] leading-relaxed">
            Attendance, admissions, fees, transport and communication — brought
            together for teachers, parents and administrators.
          </p>
          <div className="flex gap-6 mt-8 pt-8 border-t border-white/10">
            <div>
              <p className="font-display text-2xl font-bold text-amber">
                1,065
              </p>
              <p className="text-white/50 text-[12px] mt-0.5">Students</p>
            </div>
            <div>
              <p className="font-display text-2xl font-bold text-amber">96</p>
              <p className="text-white/50 text-[12px] mt-0.5">Faculty</p>
            </div>
            <div>
              <p className="font-display text-2xl font-bold text-amber">18</p>
              <p className="text-white/50 text-[12px] mt-0.5">Years</p>
            </div>
          </div>
        </div>
        <p className="relative z-10 text-white/35 text-[12px]">
          {brand.affiliation}
        </p>
      </div>

      <div className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-sm">
          <div className="lg:hidden flex items-center gap-2.5 mb-8 justify-center">
            <div className="w-9 h-9 rounded-lg bg-ink flex items-center justify-center text-amber">
              <GraduationCap size={20} />
            </div>
            <p className="font-display font-bold text-ink">
              {brand.shortName}
            </p>
          </div>
          <p className="text-amber-dark font-semibold text-[12.5px] mb-1.5">
            Welcome back
          </p>
          <h1 className="font-display text-2xl font-bold text-ink mb-1">
            Sign in to your ERP
          </h1>
          <p className="text-slate-text text-[13.5px] mb-8">
            Session {brand.session}
          </p>

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="text-[12.5px] font-semibold text-ink mb-1.5 block">
                Email address
              </label>
              <div className="relative">
                <Mail
                  size={16}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-text/40"
                />
                <input
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="email"
                  required
                  type="email"
                  placeholder="you@example.com"
                  className="w-full pl-10 pr-3.5 py-3 rounded-lg border border-black/10 text-[13.5px] outline-none focus:border-ink/40 bg-white"
                />
              </div>
            </div>
            <div>
              <label className="text-[12.5px] font-semibold text-ink mb-1.5 block">
                Password
              </label>
              <div className="relative">
                <Lock
                  size={16}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-text/40"
                />
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="current-password"
                  required
                  className="w-full pl-10 pr-3.5 py-3 rounded-lg border border-black/10 text-[13.5px] outline-none focus:border-ink/40 bg-white"
                />
              </div>
            </div>
            <div className="flex items-center justify-between text-[12.5px]">
              <label className="flex items-center gap-2 text-slate-text">
                <input
                  type="checkbox"
                  defaultChecked
                  className="accent-amber"
                />{" "}
                Keep me signed in
              </label>
              <span className="text-slate-text/60">
                <Link to="/forgot-password" className="text-info font-medium hover:underline">Forgot password?</Link>
              </span>
            </div>
            {error && (
              <p className="text-alert text-[12.5px]" role="alert">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-amber text-ink font-semibold py-3 rounded-lg flex items-center justify-center gap-2 hover:bg-amber-dark transition-colors"
            >
              {loading ? "Signing in..." : "Sign in"}
              {!loading && <ArrowRight size={16} />}
            </button>
          </form>
          <p className="text-center text-[12px] text-slate-text/60 mt-8">
            Use your school-provided credentials. Accounts are created by your
            school or platform administrator.
          </p>
        </div>
      </div>
    </div>
  );
}