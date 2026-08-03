import { FormEvent, useEffect, useState } from "react";
import { ArrowRight, BadgeCheck, Clapperboard, Loader2, Phone, UserRound } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { userApi } from "../../api/userApi";
import { useAuth } from "../../context/AuthContext";
import { defaultPathForRole } from "../../utils/roleRoutes";

function isSafeInternalPath(value: unknown): value is string {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//") && !value.includes("\\");
}

export default function StaffProfileSetupPage() {
  const { user, setNeedsProfileSetup } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [fullName, setFullName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user?.accountId) return;
    userApi.getUserById(user.accountId).then((response: any) => {
      const profile = response?.result ?? response?.data?.result ?? response?.data ?? response;
      setFullName(profile?.fullName ?? "");
      setPhoneNumber(profile?.phoneNumber ?? "");
    }).catch(() => undefined);
  }, [user?.accountId]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!user) return;
    const normalizedName = fullName.trim();
    const normalizedPhone = phoneNumber.trim();
    if (!normalizedName) {
      setError("Enter your full name.");
      return;
    }
    if (!/^(0|\+84)[0-9]{9,10}$/.test(normalizedPhone)) {
      setError("Enter a valid Vietnamese phone number.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      await userApi.completeStaffProfile(user.accountId, {
        fullName: normalizedName,
        phoneNumber: normalizedPhone,
      });
      setNeedsProfileSetup(false);
      const requestedPath = (location.state as { returnTo?: unknown } | null)?.returnTo;
      navigate(isSafeInternalPath(requestedPath) ? requestedPath : defaultPathForRole(user.role), { replace: true });
    } catch (requestError: any) {
      const code = requestError?.response?.data?.code;
      setError(code === 2001 ? "This phone number is already in use." : "Could not save your profile. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#060b16] px-4 py-10 text-white">
      <div className="mx-auto w-full max-w-xl overflow-hidden rounded-3xl border border-white/10 bg-[#0d1422] shadow-2xl shadow-blue-950/40">
        <header className="border-b border-white/10 px-7 py-6">
          <div className="mb-5 flex items-center gap-3 text-blue-400">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/15"><Clapperboard size={20} /></span>
            <span className="text-sm font-bold tracking-[0.18em]">CINEPRIME STAFF</span>
          </div>
          <h1 className="text-2xl font-bold">Complete your staff profile</h1>
          <p className="mt-2 text-sm leading-6 text-white/50">Confirm the contact details used for daily cinema operations. Your branch, position and access are managed by an administrator.</p>
        </header>

        <form onSubmit={handleSubmit} className="space-y-5 px-7 py-7">
          <div>
            <label htmlFor="staff-full-name" className="mb-2 block text-xs font-semibold uppercase tracking-wider text-white/55">Full name <span className="text-red-400">*</span></label>
            <div className="relative">
              <UserRound className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" size={17} />
              <input id="staff-full-name" value={fullName} onChange={(event) => setFullName(event.target.value)} maxLength={50} autoComplete="name" className="h-12 w-full rounded-xl border border-white/10 bg-black/25 pl-11 pr-4 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10" placeholder="Your full name" />
            </div>
          </div>

          <div>
            <label htmlFor="staff-phone" className="mb-2 block text-xs font-semibold uppercase tracking-wider text-white/55">Phone number <span className="text-red-400">*</span></label>
            <div className="relative">
              <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" size={17} />
              <input id="staff-phone" value={phoneNumber} onChange={(event) => setPhoneNumber(event.target.value)} autoComplete="tel" inputMode="tel" className="h-12 w-full rounded-xl border border-white/10 bg-black/25 pl-11 pr-4 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10" placeholder="0901234567" />
            </div>
          </div>

          <div className="flex gap-3 rounded-xl border border-blue-400/20 bg-blue-500/10 p-4 text-sm text-blue-100/75">
            <BadgeCheck className="mt-0.5 shrink-0 text-blue-400" size={18} />
            <p>You do not need to provide an identity card here. Employment and access data can only be changed by authorized management.</p>
          </div>

          {error && <div role="alert" className="rounded-xl border border-red-400/25 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</div>}

          <button type="submit" disabled={loading} className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-blue-600 text-sm font-bold transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60">
            {loading ? <><Loader2 className="animate-spin" size={17} /> Saving profile</> : <>Continue to staff workspace <ArrowRight size={17} /></>}
          </button>
        </form>
      </div>
    </main>
  );
}
