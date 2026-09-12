import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Lock, KeyRound, ArrowLeft, CheckCircle2, AlertTriangle } from "lucide-react";
import { api } from "../lib/api";
import { PasswordInput } from "../components/UI";
import { HeroDecor, FormDecor } from "../components/auth/AuthBackdrop";

export default function ResetPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!token) setError("This reset link is missing its token. Ask your administrator for a fresh link.");
  }, [token]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    if (!token) {
      setError("This reset link is invalid. Ask your administrator for a fresh link.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.resetPassword(token, password);
      if (data?.type === "changePassword") {
        setDone("session_reset");
      } else {
        setDone("password_reset");
      }
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
          className="absolute inset-0 w-full h-full object-cover opacity-[0.14]"
        />
        <HeroDecor />
        <div className="relative z-10 flex items-center gap-3">
          <img
            src="/ZipschoolOS-Transparent-logo.png"
            alt=""
            className="w-12 h-12 object-contain shrink-0"
          />
          <div>
            <p className="font-display font-bold text-lg leading-tight">Zipschool OS</p>
            <p className="text-white/50 text-[12.5px]">School operations, connected</p>
          </div>
        </div>
        <div className="relative z-10 max-w-md">
          <h2 className="font-display text-4xl font-bold leading-tight">
            Set a fresh password, <span className="text-amber">securely.</span>
          </h2>
          <p className="text-white/60 mt-4 text-[14.5px] leading-relaxed">
            Set a fresh password for your Zipschool OS account. The link is one-time and
            expires shortly after it is generated.
          </p>
        </div>
        <p className="relative z-10 text-white/35 text-[12px]">School Administration</p>
      </div>

      <div className="relative flex items-center justify-center p-6 sm:p-12 overflow-hidden">
        <FormDecor />
        <div className="w-full max-w-sm relative z-10">
          <div className="lg:hidden flex items-center gap-2.5 mb-8 justify-center">
            <img
              src="/ZipschoolOS-Transparent-logo.png"
              alt=""
              className="w-10 h-10 object-contain shrink-0"
            />
            <p className="font-display font-bold text-ink">Zipschool OS</p>
          </div>
          <p className="text-amber-dark font-semibold text-[12.5px] mb-1.5">Account recovery</p>
          <h1 className="font-display text-2xl font-bold text-ink mb-1">Reset your password</h1>
          <p className="text-slate-text text-[13.5px] mb-8">One-time link · expires in 15 minutes</p>

          {done ? (
            <div className="rounded-xl border border-black/10 bg-white p-6">
              <div className="flex items-center gap-2.5 mb-2">
                {done === "session_reset" ? (
                  <AlertTriangle size={20} className="text-amber" />
                ) : (
                  <CheckCircle2 size={20} className="text-emerald-600" />
                )}
                <p className="font-display font-bold text-ink">
                  {done === "session_reset" ? "Password changed" : "Password set"}
                </p>
              </div>
              <p className="text-[13px] text-slate-text leading-relaxed mb-5">
                {done === "session_reset"
                  ? "Your password was updated and you were signed out of existing sessions for your own protection."
                  : "Your password was updated. Your previous sessions have been signed out for your own protection."}
              </p>
              <button
                onClick={() => navigate("/login", { replace: true })}
                className="w-full bg-amber text-ink font-semibold py-3 rounded-lg flex items-center justify-center gap-2 hover:bg-amber-dark transition-colors"
              >
                <ArrowLeft size={16} /> Go to login
              </button>
            </div>
          ) : (
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div>
                <label className="text-[12.5px] font-semibold text-ink mb-1.5 block">New password</label>
                <PasswordInput
                  icon={KeyRound}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="new-password"
                  required
                  minLength={8}
                  placeholder="At least 8 characters"
                />
              </div>
              <div>
                <label className="text-[12.5px] font-semibold text-ink mb-1.5 block">Confirm password</label>
                <PasswordInput
                  icon={Lock}
                  value={confirm}
                  onChange={(event) => setConfirm(event.target.value)}
                  autoComplete="new-password"
                  required
                  placeholder="Re-enter new password"
                />
              </div>
              {error && (
                <p className="text-alert text-[12.5px]" role="alert">
                  {error}
                </p>
              )}
              <button
                type="submit"
                disabled={loading || !token}
                className="w-full bg-amber text-ink font-semibold py-3 rounded-lg flex items-center justify-center gap-2 hover:bg-amber-dark transition-colors disabled:opacity-50"
              >
                {loading ? "Updating…" : "Set new password"}
              </button>
            </form>
          )}

          <p className="text-center text-[12px] text-slate-text/60 mt-8">
            <Link to="/login" className="text-info font-medium">
              Back to sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}