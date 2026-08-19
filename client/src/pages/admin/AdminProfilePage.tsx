import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  CalendarDays,
  CheckCircle2,
  Clock3,
  ExternalLink,
  KeyRound,
  Mail,
  MapPin,
  Phone,
  Settings,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { authApi } from "../../api/authApi";
import { userApi } from "../../api/userApi";
import { useAuth } from "../../context/AuthContext";

type AccountRole = { roleName?: string; name?: string } | string;

interface AccountDetails {
  accountId: string;
  username?: string;
  email?: string;
  status?: string;
  lastLoginAt?: string;
  createdAt?: string;
  roles?: AccountRole[];
}

interface ProfileDetails {
  accountId: string;
  email?: string;
  fullName?: string;
  phoneNumber?: string;
  address?: string;
  avatarUrl?: string;
  updatedAt?: string;
}

const roleLabels: Record<string, string> = {
  ROLE_SUPER_ADMIN: "Super administrator",
  ROLE_ADMIN: "Administrator",
  ROLE_BRANCH_MANAGER: "Branch manager",
  ROLE_PROGRAMMING_OPERATOR: "Programming operator",
  ROLE_PROGRAMMING_APPROVER: "Programming approver",
  ROLE_FINANCE_OFFICER: "Finance officer",
  ROLE_FINANCE_APPROVER: "Finance approver",
  ROLE_COMMERCIAL_MANAGER: "Commercial manager",
  ROLE_SYSTEM_ADMIN: "System administrator",
  ROLE_SECURITY_AUDITOR: "Security auditor",
  ROLE_EMPLOYEE: "Employee",
};

function unwrap<T>(response: any): T {
  return (response?.result ?? response?.data?.result ?? response?.data ?? response) as T;
}

function formatDateTime(value?: string): string {
  if (!value) return "Not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not recorded";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function getInitials(value: string): string {
  const words = value.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "AD";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0]}${words[words.length - 1]?.[0] ?? ""}`.toUpperCase();
}

function humanizeRole(role: string): string {
  return role.replace(/^ROLE_/, "").replace(/_/g, " ");
}

function roleName(role: AccountRole): string {
  if (typeof role === "string") return role;
  return role.roleName ?? role.name ?? "";
}

function DetailRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value?: string }) {
  return (
    <div className="admin-profile-detail-row">
      <span className="admin-profile-detail-icon"><Icon size={16} /></span>
      <div>
        <span className="admin-profile-detail-label">{label}</span>
        <strong className={value ? "" : "is-empty"}>{value || "Not provided"}</strong>
      </div>
    </div>
  );
}

function ProfileSkeleton() {
  return (
    <div className="admin-profile-skeleton" aria-label="Loading profile">
      <div className="admin-profile-skeleton-line wide" />
      <div className="admin-profile-skeleton-grid">
        <div className="admin-profile-skeleton-card" />
        <div className="admin-profile-skeleton-card" />
      </div>
    </div>
  );
}

export default function AdminProfilePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [account, setAccount] = useState<AccountDetails | null>(null);
  const [profile, setProfile] = useState<ProfileDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.accountId) {
      setError("The signed-in account could not be identified.");
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);
    setError(null);

    Promise.allSettled([
      authApi.getMyAccount(),
      userApi.getUserById(user.accountId),
    ]).then(([accountResult, profileResult]) => {
      if (!active) return;

      if (accountResult.status === "fulfilled") {
        setAccount(unwrap<AccountDetails>(accountResult.value));
      } else {
        setError("Could not load the account profile. Please try again.");
      }

      if (profileResult.status === "fulfilled") {
        setProfile(unwrap<ProfileDetails>(profileResult.value));
      } else {
        setProfile(null);
      }
    }).finally(() => {
      if (active) setLoading(false);
    });

    return () => { active = false; };
  }, [user?.accountId]);

  const roles = useMemo(() => {
    const apiRoles = account?.roles?.map(roleName).filter(Boolean) ?? [];
    return apiRoles.length > 0 ? apiRoles : user?.role ? [user.role] : [];
  }, [account?.roles, user?.role]);

  const displayName = profile?.fullName || account?.username || user?.username || "Administrator";
  const displayEmail = profile?.email || account?.email;
  const primaryRole = user?.role ?? roles[0] ?? "ROLE_ADMIN";
  const status = (account?.status || "ACTIVE").toUpperCase();
  const canManageSettings = user?.permissions.includes("SYSTEM_CONFIG_MANAGE")
    || user?.roles.some((role) => role === "ROLE_SUPER_ADMIN" || role === "ROLE_ADMIN");

  return (
    <section className="admin-profile-page">
      <style>{adminProfileStyles}</style>

      <header className="admin-profile-header">
        <div>
          <p className="admin-profile-eyebrow"><ShieldCheck size={14} /> ACCOUNT & ACCESS</p>
          <h1>My profile</h1>
          <p>Review your CinePrime identity, account status and administrative access.</p>
        </div>
        {canManageSettings && (
          <button type="button" className="admin-profile-secondary" onClick={() => navigate("/admin/settings")}>
            <Settings size={16} /> Account settings
          </button>
        )}
      </header>

      {loading && <ProfileSkeleton />}

      {!loading && error && !account && (
        <div className="admin-profile-error">
          <Activity size={20} />
          <div><strong>Profile unavailable</strong><p>{error}</p></div>
          <button type="button" onClick={() => window.location.reload()}>Try again</button>
        </div>
      )}

      {!loading && account && (
        <>
          <div className="admin-profile-overview">
            <article className="admin-profile-identity">
              <div className="admin-profile-orbit orbit-a" />
              <div className="admin-profile-orbit orbit-b" />
              <div className="admin-profile-avatar">
                {profile?.avatarUrl ? <img src={profile.avatarUrl} alt="" /> : <span>{getInitials(displayName)}</span>}
              </div>
              <div className="admin-profile-identity-copy">
                <span className="admin-profile-role-label">{roleLabels[primaryRole] ?? humanizeRole(primaryRole)}</span>
                <h2>{displayName}</h2>
                <p>@{account.username || user?.username}</p>
              </div>
              <span className={`admin-profile-status status-${status.toLowerCase()}`}>
                <CheckCircle2 size={14} /> {status === "ACTIVE" ? "Active account" : status}
              </span>
            </article>

            <div className="admin-profile-summary-grid">
              <article className="admin-profile-summary-card">
                <span className="admin-profile-summary-icon blue"><ShieldCheck size={18} /></span>
                <div><span>Primary access</span><strong>{roleLabels[primaryRole] ?? primaryRole}</strong></div>
              </article>
              <article className="admin-profile-summary-card">
                <span className="admin-profile-summary-icon green"><Activity size={18} /></span>
                <div><span>Account status</span><strong>{status === "ACTIVE" ? "Active" : status}</strong></div>
              </article>
              <article className="admin-profile-summary-card">
                <span className="admin-profile-summary-icon violet"><Clock3 size={18} /></span>
                <div><span>Last sign-in</span><strong>{formatDateTime(account.lastLoginAt)}</strong></div>
              </article>
            </div>
          </div>

          <div className="admin-profile-content-grid">
            <article className="admin-profile-panel">
              <div className="admin-profile-panel-heading">
                <div><span>IDENTITY</span><h2>Contact information</h2></div>
                <UserRound size={19} />
              </div>
              <div className="admin-profile-detail-list">
                <DetailRow icon={Mail} label="Email address" value={displayEmail} />
                <DetailRow icon={Phone} label="Phone number" value={profile?.phoneNumber} />
                <DetailRow icon={MapPin} label="Address" value={profile?.address} />
              </div>
              {!profile && <p className="admin-profile-note">Personal contact details have not been created in user-service for this administrator.</p>}
            </article>

            <article className="admin-profile-panel">
              <div className="admin-profile-panel-heading">
                <div><span>SECURITY</span><h2>Account & access</h2></div>
                <KeyRound size={19} />
              </div>
              <div className="admin-profile-detail-list">
                <DetailRow icon={UserRound} label="Sign-in username" value={account.username || user?.username} />
                <DetailRow icon={CalendarDays} label="Account created" value={formatDateTime(account.createdAt)} />
                <DetailRow icon={Clock3} label="Last sign-in" value={formatDateTime(account.lastLoginAt)} />
              </div>
              <div className="admin-profile-access-list">
                <span>Assigned roles</span>
                <div>{roles.map((role) => <b key={role}><ShieldCheck size={12} /> {roleLabels[role] ?? humanizeRole(role)}</b>)}</div>
              </div>
            </article>
          </div>

          <article className="admin-profile-footer-card">
            <div>
              <span className="admin-profile-footer-icon"><ExternalLink size={18} /></span>
              <div><strong>Customer experience</strong><p>Open the public CinePrime site without changing your administrative account.</p></div>
            </div>
            <button type="button" className="admin-profile-secondary" onClick={() => navigate("/home")}>
              View customer site <ExternalLink size={15} />
            </button>
          </article>
        </>
      )}
    </section>
  );
}

const adminProfileStyles = `
  @keyframes admin-profile-pulse { 0%,100%{opacity:.45} 50%{opacity:.8} }
  .admin-profile-page { max-width:1280px; margin:0 auto; color:var(--text-main); }
  .admin-profile-header { display:flex; align-items:flex-end; justify-content:space-between; gap:24px; margin-bottom:24px; }
  .admin-profile-eyebrow { display:flex; align-items:center; gap:7px; margin:0 0 7px; color:#3b82f6; font-size:10px; font-weight:800; letter-spacing:.16em; }
  .admin-profile-header h1 { margin:0; color:var(--text-main); font-size:27px; font-weight:750; letter-spacing:-.035em; }
  .admin-profile-header p:not(.admin-profile-eyebrow) { margin:5px 0 0; color:var(--text-sub); font-size:13px; }
  .admin-profile-secondary { display:inline-flex; align-items:center; justify-content:center; gap:8px; min-height:38px; padding:0 14px; border:1px solid var(--border-color); border-radius:10px; background:var(--bg-card); color:var(--text-main); font-size:12px; font-weight:650; cursor:pointer; transition:border-color .16s ease, background .16s ease; }
  .admin-profile-secondary:hover { border-color:rgba(59,130,246,.55); background:rgba(59,130,246,.08); }
  .admin-profile-overview { display:grid; grid-template-columns:360px minmax(0,1fr); gap:18px; }
  .admin-profile-identity { position:relative; display:flex; min-height:208px; align-items:center; gap:18px; overflow:hidden; padding:26px; border:1px solid rgba(59,130,246,.24); border-radius:18px; background:linear-gradient(135deg,rgba(15,50,112,.96),rgba(18,31,67,.96)); box-shadow:0 20px 55px rgba(0,0,0,.16); }
  .admin-profile-orbit { position:absolute; border:1px solid rgba(147,197,253,.14); border-radius:50%; pointer-events:none; }
  .admin-profile-orbit.orbit-a { width:230px; height:230px; right:-120px; top:-120px; }
  .admin-profile-orbit.orbit-b { width:180px; height:180px; left:-105px; bottom:-115px; }
  .admin-profile-avatar { position:relative; z-index:1; display:grid; width:78px; height:78px; flex:0 0 78px; place-items:center; overflow:hidden; border-radius:50%; background:linear-gradient(145deg,#3b82f6,#1d4ed8 58%,#312e81); color:#fff; font-size:22px; font-weight:800; box-shadow:0 0 0 5px rgba(96,165,250,.12),0 14px 32px rgba(0,0,0,.25); }
  .admin-profile-avatar img { width:100%; height:100%; object-fit:cover; }
  .admin-profile-identity-copy { position:relative; z-index:1; min-width:0; }
  .admin-profile-role-label { color:#93c5fd; font-size:9px; font-weight:800; letter-spacing:.13em; text-transform:uppercase; }
  .admin-profile-identity h2 { margin:7px 0 3px; overflow:hidden; color:#fff; font-size:20px; font-weight:750; text-overflow:ellipsis; white-space:nowrap; }
  .admin-profile-identity-copy p { margin:0; color:rgba(219,234,254,.65); font-size:12px; }
  .admin-profile-status { position:absolute; left:26px; bottom:22px; display:inline-flex; align-items:center; gap:6px; color:#86efac; font-size:10px; font-weight:700; }
  .admin-profile-summary-grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:14px; }
  .admin-profile-summary-card { display:flex; min-width:0; align-items:flex-start; gap:12px; padding:19px; border:1px solid var(--border-color); border-radius:16px; background:var(--bg-card); }
  .admin-profile-summary-icon { display:grid; width:38px; height:38px; flex:0 0 38px; place-items:center; border-radius:11px; }
  .admin-profile-summary-icon.blue { background:rgba(59,130,246,.12); color:#3b82f6; }
  .admin-profile-summary-icon.green { background:rgba(16,185,129,.12); color:#10b981; }
  .admin-profile-summary-icon.violet { background:rgba(139,92,246,.12); color:#8b5cf6; }
  .admin-profile-summary-card div span { display:block; margin:1px 0 8px; color:var(--text-sub); font-size:10px; text-transform:uppercase; letter-spacing:.08em; }
  .admin-profile-summary-card div strong { display:block; overflow:hidden; color:var(--text-main); font-size:13px; line-height:1.45; text-overflow:ellipsis; }
  .admin-profile-content-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:18px; margin-top:18px; }
  .admin-profile-panel { padding:22px 24px; border:1px solid var(--border-color); border-radius:18px; background:var(--bg-card); }
  .admin-profile-panel-heading { display:flex; align-items:center; justify-content:space-between; padding-bottom:17px; border-bottom:1px solid var(--border-color); color:#3b82f6; }
  .admin-profile-panel-heading span { color:#3b82f6; font-size:9px; font-weight:800; letter-spacing:.15em; }
  .admin-profile-panel-heading h2 { margin:4px 0 0; color:var(--text-main); font-size:15px; font-weight:700; }
  .admin-profile-detail-row { display:flex; align-items:center; gap:12px; min-height:66px; border-bottom:1px solid var(--border-color); }
  .admin-profile-detail-icon { display:grid; width:34px; height:34px; flex:0 0 34px; place-items:center; border-radius:10px; background:rgba(59,130,246,.09); color:#3b82f6; }
  .admin-profile-detail-row > div { min-width:0; }
  .admin-profile-detail-label { display:block; margin-bottom:3px; color:var(--text-sub); font-size:9px; font-weight:700; letter-spacing:.08em; text-transform:uppercase; }
  .admin-profile-detail-row strong { display:block; overflow:hidden; color:var(--text-main); font-size:12px; font-weight:600; text-overflow:ellipsis; white-space:nowrap; }
  .admin-profile-detail-row strong.is-empty { color:var(--text-sub); font-weight:500; }
  .admin-profile-note { margin:14px 0 0; color:var(--text-sub); font-size:10px; line-height:1.5; }
  .admin-profile-access-list { padding-top:15px; }
  .admin-profile-access-list > span { display:block; margin-bottom:9px; color:var(--text-sub); font-size:9px; font-weight:700; letter-spacing:.08em; text-transform:uppercase; }
  .admin-profile-access-list > div { display:flex; flex-wrap:wrap; gap:7px; }
  .admin-profile-access-list b { display:inline-flex; align-items:center; gap:5px; padding:6px 9px; border:1px solid rgba(59,130,246,.2); border-radius:8px; background:rgba(59,130,246,.08); color:#60a5fa; font-size:10px; font-weight:650; text-transform:capitalize; }
  .admin-profile-footer-card { display:flex; align-items:center; justify-content:space-between; gap:20px; margin-top:18px; padding:17px 20px; border:1px solid var(--border-color); border-radius:16px; background:var(--bg-card); }
  .admin-profile-footer-card > div { display:flex; align-items:center; gap:12px; }
  .admin-profile-footer-icon { display:grid; width:38px; height:38px; place-items:center; border-radius:11px; background:rgba(59,130,246,.1); color:#3b82f6; }
  .admin-profile-footer-card strong { display:block; color:var(--text-main); font-size:12px; }
  .admin-profile-footer-card p { margin:3px 0 0; color:var(--text-sub); font-size:10px; }
  .admin-profile-error { display:flex; align-items:center; gap:13px; padding:18px; border:1px solid rgba(239,68,68,.25); border-radius:14px; background:rgba(239,68,68,.08); color:#ef4444; }
  .admin-profile-error p { margin:3px 0 0; color:var(--text-sub); font-size:12px; }
  .admin-profile-error button { margin-left:auto; border:0; background:transparent; color:#ef4444; font-weight:700; cursor:pointer; }
  .admin-profile-skeleton-line,.admin-profile-skeleton-card { position:relative; overflow:hidden; border-radius:15px; background:var(--bg-card); }
  .admin-profile-skeleton-line:after,.admin-profile-skeleton-card:after { position:absolute; inset:0; background:linear-gradient(90deg,transparent,rgba(148,163,184,.08),transparent); content:""; animation:admin-profile-pulse 1.3s ease-in-out infinite; }
  .admin-profile-skeleton-line.wide { width:260px; height:30px; margin-bottom:20px; }
  .admin-profile-skeleton-grid { display:grid; grid-template-columns:360px 1fr; gap:18px; }
  .admin-profile-skeleton-card { height:208px; }
  @media(max-width:1000px){ .admin-profile-overview{grid-template-columns:1fr}.admin-profile-summary-grid{grid-template-columns:repeat(3,minmax(0,1fr))} }
  @media(max-width:760px){ .admin-profile-header,.admin-profile-footer-card{align-items:flex-start;flex-direction:column}.admin-profile-summary-grid,.admin-profile-content-grid{grid-template-columns:1fr}.admin-profile-identity{min-height:195px}.admin-profile-skeleton-grid{grid-template-columns:1fr} }
`;
