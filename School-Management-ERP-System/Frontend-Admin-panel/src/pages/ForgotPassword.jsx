import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { GraduationCap, ArrowRight, ArrowLeft, Mail, KeyRound, Lock, CheckCircle2, RefreshCw } from "lucide-react";
import { api } from "../lib/api";

const brand = {
  name: "School Management ERP",
  shortName: "School ERP",
  tagline: "School operations, connected",
  affiliation: "School Administration",
};

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState("");
  const [maskedEmail, setMaskedEmail] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [resetToken, setResetToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);
  const otpRefs = useRef([]);

  useEffect(() => {
    if (resendTimer <= 0) return;
    const id = setTimeout(() => setResendTimer((t) => t - 1), 1000);
    return () => clearTimeout(id);
  }, [resendTimer]);

  const handleRequestOtp = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { data } = await api.forgotPassword(email.trim());
      setMaskedEmail(data?.maskedEmail || email.trim());
      setStep(2);
      setResendTimer(60);
      setTimeout(() => otpRefs.current[0]?.focus(), 100);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (index, value) => {
    if (!/^\d*$/.test(value)) return;
    const next = [...otp];
    next[index] = value.slice(-1);
    setOtp(next);
    if (value && index < 5) otpRefs.current[index + 1]?.focus();
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
    if (e.key === "Enter") handleVerifyOtp(e);
  };

  const handleOtpPaste = (e) => {
    const text = (e.clipboardData.getData("text") || "").replace(/\D/g, "").slice(0, 6);
    if (!text) return;
    const next = [...otp];
    for (let i = 0; i < 6; i++) next[i] = text[i] || "";
    setOtp(next);
    otpRefs.current[Math.min(text.length, 5)]?.focus();
  };

  const handleVerifyOtp = async (e) => {
    e?.preventDefault();
    setError("");
    const code = otp.join("");
    if (code.length !== 6) {
      setError("Please enter the complete 6-digit OTP");
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.verifyResetOtp(email.trim(), code);
      setResetToken(data?.resetToken || "");
      setStep(3);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError("");
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }
    setLoading(true);
    try {
      await api.resetPasswordOtp(resetToken, password);
      setStep(4);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    setError("");
    setLoading(true);
    try {
      await api.forgotPassword(email.trim());
      setOtp(["", "", "", "", ""]);
      setResendTimer(60);
      otpRefs.current[0]?.focus();
    } catch (err) {
      setError(err.message);
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
            <p className="font-display font-bold text-lg leading-tight">{brand.name}</p>
            <p className="text-white/50 text-[12.5px]">{brand.tagline}</p>
          </div>
        </div>
        <div className="relative z-10 max-w-md">
          <h2 className="font-display text-4xl font-bold leading-tight">
            Account recovery your way.
          </h2>
          <p className="text-white/60 mt-4 text-[14.5px] leading-relaxed">
            Reset your password securely using a one-time OTP sent to your email address.
          </p>
          <div className="flex gap-4 mt-8 pt-8 border-t border-white/10 text-[13px]">
            <div className="flex items-center gap-2 text-white/50">
              <div className="w-6 h-6 rounded-full bg-amber/20 text-amber flex items-center justify-center text-[11px] font-bold">1</div>
              Enter email
            </div>
            <div className="flex items-center gap-2 text-white/50">
              <div className="w-6 h-6 rounded-full bg-amber/20 text-amber flex items-center justify-center text-[11px] font-bold">2</div>
              Verify OTP
            </div>
            <div className="flex items-center gap-2 text-white/50">
              <div className="w-6 h-6 rounded-full bg-amber/20 text-amber flex items-center justify-center text-[11px] font-bold">3</div>
              New password
            </div>
          </div>
        </div>
        <p className="relative z-10 text-white/35 text-[12px]">{brand.affiliation}</p>
      </div>

      <div className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-sm">
          <div className="lg:hidden flex items-center gap-2.5 mb-8 justify-center">
            <div className="w-9 h-9 rounded-lg bg-ink flex items-center justify-center text-amber">
              <GraduationCap size={20} />
            </div>
            <p className="font-display font-bold text-ink">{brand.shortName}</p>
          </div>

          {step === 1 && (
            <>
              <p className="text-amber-dark font-semibold text-[12.5px] mb-1.5">Password recovery</p>
              <h1 className="font-display text-2xl font-bold text-ink mb-1">Forgot your password?</h1>
              <p className="text-slate-text text-[13.5px] mb-8">Enter your registered email and we'll send you an OTP</p>
              <form className="space-y-4" onSubmit={handleRequestOtp}>
                <div>
                  <label className="text-[12.5px] font-semibold text-ink mb-1.5 block">Email address</label>
                  <div className="relative">
                    <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-text/40" />
                    <input
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      autoComplete="email"
                      required
                      type="email"
                      placeholder="you@example.com"
                      className="w-full pl-10 pr-3.5 py-3 rounded-lg border border-black/10 text-[13.5px] outline-none focus:border-ink/40 bg-white"
                    />
                  </div>
                </div>
                {error && <p className="text-alert text-[12.5px]" role="alert">{error}</p>}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-amber text-ink font-semibold py-3 rounded-lg flex items-center justify-center gap-2 hover:bg-amber-dark transition-colors"
                >
                  {loading ? "Sending OTP..." : "Send OTP"}
                  {!loading && <ArrowRight size={16} />}
                </button>
              </form>
            </>
          )}

          {step === 2 && (
            <>
              <p className="text-amber-dark font-semibold text-[12.5px] mb-1.5">Verify OTP</p>
              <h1 className="font-display text-2xl font-bold text-ink mb-1">Enter the OTP</h1>
              <p className="text-slate-text text-[13.5px] mb-8">
                We sent a 6-digit code to <span className="font-semibold text-ink">{maskedEmail}</span>
              </p>
              <form className="space-y-4" onSubmit={handleVerifyOtp}>
                <div>
                  <label className="text-[12.5px] font-semibold text-ink mb-3 block">One-time password</label>
                  <div className="flex gap-2.5 justify-center" onPaste={handleOtpPaste}>
                    {otp.map((digit, i) => (
                      <input
                        key={i}
                        ref={(el) => { otpRefs.current[i] = el; }}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        value={digit}
                        onChange={(e) => handleOtpChange(i, e.target.value)}
                        onKeyDown={(e) => handleOtpKeyDown(i, e)}
                        className="w-11 h-12 text-center text-lg font-bold rounded-lg border border-black/10 outline-none focus:border-ink/40 bg-white"
                      />
                    ))}
                  </div>
                </div>
                <div className="flex justify-center">
                  <button
                    type="button"
                    onClick={handleResendOtp}
                    disabled={resendTimer > 0 || loading}
                    className="text-[12.5px] font-semibold text-info flex items-center gap-1.5 disabled:text-slate-text/40 disabled:cursor-not-allowed"
                  >
                    <RefreshCw size={13} className={resendTimer > 0 ? "" : "hidden"} />
                    {resendTimer > 0 ? `Resend in ${resendTimer}s` : "Resend OTP"}
                  </button>
                </div>
                {error && <p className="text-alert text-[12.5px]" role="alert">{error}</p>}
                <button
                  type="submit"
                  disabled={loading || otp.join("").length !== 6}
                  className="w-full bg-amber text-ink font-semibold py-3 rounded-lg flex items-center justify-center gap-2 hover:bg-amber-dark transition-colors disabled:opacity-50"
                >
                  {loading ? "Verifying..." : "Verify OTP"}
                  {!loading && <ArrowRight size={16} />}
                </button>
                <button
                  type="button"
                  onClick={() => { setStep(1); setOtp(["","","","","",""]); setError(""); }}
                  className="w-full text-center text-[12.5px] font-semibold text-slate-text/60 flex items-center justify-center gap-1.5 hover:text-ink"
                >
                  <ArrowLeft size={13} /> Use a different email
                </button>
              </form>
            </>
          )}

          {step === 3 && (
            <>
              <p className="text-amber-dark font-semibold text-[12.5px] mb-1.5">Set new password</p>
              <h1 className="font-display text-2xl font-bold text-ink mb-1">Create a new password</h1>
              <p className="text-slate-text text-[13.5px] mb-8">OTP verified. Choose a strong password for your account.</p>
              <form className="space-y-4" onSubmit={handleResetPassword}>
                <div>
                  <label className="text-[12.5px] font-semibold text-ink mb-1.5 block">New password</label>
                  <div className="relative">
                    <KeyRound size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-text/40" />
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="new-password"
                      required
                      minLength={8}
                      placeholder="At least 8 characters"
                      className="w-full pl-10 pr-3.5 py-3 rounded-lg border border-black/10 text-[13.5px] outline-none focus:border-ink/40 bg-white"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[12.5px] font-semibold text-ink mb-1.5 block">Confirm password</label>
                  <div className="relative">
                    <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-text/40" />
                    <input
                      type="password"
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      autoComplete="new-password"
                      required
                      placeholder="Re-enter new password"
                      className="w-full pl-10 pr-3.5 py-3 rounded-lg border border-black/10 text-[13.5px] outline-none focus:border-ink/40 bg-white"
                    />
                  </div>
                </div>
                {error && <p className="text-alert text-[12.5px]" role="alert">{error}</p>}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-amber text-ink font-semibold py-3 rounded-lg flex items-center justify-center gap-2 hover:bg-amber-dark transition-colors"
                >
                  {loading ? "Updating..." : "Set new password"}
                  {!loading && <ArrowRight size={16} />}
                </button>
              </form>
            </>
          )}

          {step === 4 && (
            <div className="rounded-xl border border-black/10 bg-white p-6">
              <div className="flex items-center gap-2.5 mb-2">
                <CheckCircle2 size={20} className="text-emerald-600" />
                <p className="font-display font-bold text-ink">Password updated</p>
              </div>
              <p className="text-[13px] text-slate-text leading-relaxed mb-5">
                Your password has been reset successfully. You can now sign in with your new password.
              </p>
              <button
                onClick={() => navigate("/login", { replace: true })}
                className="w-full bg-amber text-ink font-semibold py-3 rounded-lg flex items-center justify-center gap-2 hover:bg-amber-dark transition-colors"
              >
                <ArrowLeft size={16} /> Go to sign in
              </button>
            </div>
          )}

          <p className="text-center text-[12px] text-slate-text/60 mt-8">
            <Link to="/login" className="text-info font-medium">Back to sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
