import { useMemo, useState } from "react";
import { CheckCircle2, Eye, EyeOff, Loader2, LockKeyhole } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { authApi } from "../../api/authApi";

export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const validPassword = useMemo(() => /[a-z]/.test(password) && /[A-Z]/.test(password) && /\d/.test(password) && password.length >= 8, [password]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!token) return setError("This reset link is missing its token.");
    if (!validPassword) return setError("Use at least 8 characters with uppercase, lowercase, and a number.");
    if (password !== confirm) return setError("Passwords do not match.");
    setLoading(true); setError(null);
    try {
      await authApi.resetPassword({ token, newPassword: password });
      setDone(true);
    } catch (err: any) {
      const code = err?.response?.data?.code;
      setError(code === 1034 ? "This link has expired. Request a new one." : "This link is invalid or has already been used.");
    } finally { setLoading(false); }
  };

  if (done) return (
    <div className="text-center py-5">
      <div className="mx-auto mb-5 h-14 w-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center"><CheckCircle2 size={27} className="text-emerald-400" /></div>
      <h2 className="text-2xl font-bold text-white mb-3">Password updated</h2>
      <p className="text-sm text-white/45 mb-7">All previous sessions were signed out. You can now use your new password.</p>
      <Link to="/login" className="block w-full rounded-xl bg-blue-600 py-3.5 text-sm font-bold text-white hover:bg-blue-500">Return to sign in</Link>
    </div>
  );

  return (
    <div>
      <div className="mb-7 h-12 w-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center"><LockKeyhole size={22} className="text-blue-400" /></div>
      <h2 className="text-[30px] leading-tight font-bold text-white mb-2">Create a new password</h2>
      <p className="text-sm text-white/40 mb-7">Your new password will sign out every existing CinePrime session.</p>
      <form onSubmit={submit} className="space-y-4">
        {error && <div className="rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-400">{error}</div>}
        {[{label:"New password", value:password, set:setPassword}, {label:"Confirm password", value:confirm, set:setConfirm}].map((field) => (
          <label className="block" key={field.label}>
            <span className="block mb-2 text-xs font-semibold uppercase tracking-wider text-white/55">{field.label}</span>
            <span className="relative block">
              <input required type={visible ? "text" : "password"} autoComplete="new-password" value={field.value} onChange={(e) => field.set(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-[#141414] py-3.5 pl-4 pr-12 text-sm text-white outline-none focus:border-blue-500/60 focus:ring-4 focus:ring-blue-500/10" />
              <button type="button" aria-label="Toggle password visibility" onClick={() => setVisible(!visible)} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/35 hover:text-white/70">{visible ? <EyeOff size={17}/> : <Eye size={17}/>}</button>
            </span>
          </label>
        ))}
        <p className={`text-xs ${password && !validPassword ? "text-amber-400" : "text-white/30"}`}>At least 8 characters, including uppercase, lowercase, and a number.</p>
        <button disabled={loading || !token} className="w-full rounded-xl bg-blue-600 py-3.5 text-sm font-bold text-white hover:bg-blue-500 disabled:opacity-50 flex items-center justify-center gap-2">{loading && <Loader2 size={16} className="animate-spin"/>} Reset password</button>
      </form>
      <p className="mt-6 text-center text-sm text-white/35">Need another link? <Link to="/forgot-password" className="text-blue-400 hover:text-blue-300">Request one</Link></p>
    </div>
  );
}
