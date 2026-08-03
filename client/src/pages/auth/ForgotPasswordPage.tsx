import { useState } from "react";
import { ArrowLeft, CheckCircle2, Loader2, Mail } from "lucide-react";
import { Link } from "react-router-dom";
import { authApi } from "../../api/authApi";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await authApi.forgotPassword(email.trim());
      setSubmitted(true);
    } catch (err: any) {
      if (err?.response?.status === 429) setError("Too many requests. Please wait before trying again.");
      else setError("We could not process this request. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <Link to="/login" className="inline-flex items-center gap-2 mb-8 text-sm text-blue-400 hover:text-blue-300">
        <ArrowLeft size={15} /> Back to sign in
      </Link>
      {submitted ? (
        <div className="text-center py-4">
          <div className="mx-auto mb-5 h-14 w-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
            <CheckCircle2 className="text-emerald-400" size={26} />
          </div>
          <h2 className="text-2xl font-bold text-white mb-3">Check your email</h2>
          <p className="text-sm leading-6 text-white/45 mb-7">
            If an active CinePrime account exists for <span className="text-white/75">{email}</span>, we sent a one-time reset link.
          </p>
          <button onClick={() => setSubmitted(false)} className="w-full rounded-xl border border-white/10 py-3 text-sm font-semibold text-white hover:bg-white/5">
            Use another email
          </button>
        </div>
      ) : (
        <>
          <h2 className="text-[30px] leading-tight font-bold text-white mb-2">Forgot your password?</h2>
          <p className="text-sm text-white/40 mb-8">Enter your account email. The reset link expires after 30 minutes.</p>
          <form onSubmit={submit} className="space-y-5">
            {error && <div className="rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-400">{error}</div>}
            <label className="block">
              <span className="block mb-2 text-xs font-semibold uppercase tracking-wider text-white/55">Email address</span>
              <span className="relative block">
                <Mail size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" />
                <input required type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com" className="w-full rounded-xl border border-white/10 bg-[#141414] py-3.5 pl-11 pr-4 text-sm text-white outline-none focus:border-blue-500/60 focus:ring-4 focus:ring-blue-500/10" />
              </span>
            </label>
            <button disabled={loading} className="w-full rounded-xl bg-blue-600 py-3.5 text-sm font-bold text-white hover:bg-blue-500 disabled:opacity-60 flex items-center justify-center gap-2">
              {loading && <Loader2 size={16} className="animate-spin" />} Send reset link
            </button>
          </form>
        </>
      )}
    </div>
  );
}
