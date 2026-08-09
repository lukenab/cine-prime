import { useEffect, useRef, useState } from "react";
import {
  ArrowUpRight,
  Award,
  Calendar,
  Camera,
  CheckCircle,
  Clock3,
  CreditCard,
  Mail,
  MapPin,
  Phone,
  Sparkles,
  User,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { userApi } from "../../api/userApi";
import { loyaltyApi, MembershipSummary } from "../../api/loyaltyApi";
import { useAuth } from "../../context/AuthContext";
import { publishProfileUpdated } from "../../utils/profileEvents";

interface Profile {
  accountId: string;
  email: string;
  fullName?: string;
  phoneNumber?: string;
  dateOfBirth?: string;
  gender?: string;
  address?: string;
  identityCard?: string;
  avatarUrl?: string;
  profileCompleted?: boolean;
}

function maskIdentityCard(raw?: string): string {
  if (!raw || raw.length < 4) return raw ?? "—";
  return `${raw.slice(0, 4)}••••${raw.slice(-4)}`;
}

function formatDate(value?: string): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function formatMoney(value?: number): string {
  return `${(value ?? 0).toLocaleString("vi-VN")} ₫`;
}

function InfoItem({ icon: Icon, label, value }: { icon: any; label: string; value?: string }) {
  return (
    <div className="profile-info-item">
      <div className="profile-info-icon"><Icon size={16} /></div>
      <div className="profile-info-copy">
        <span className="profile-info-label">{label}</span>
        <span className={value ? "profile-info-value" : "profile-info-value profile-info-empty"}>{value || "Not provided"}</span>
      </div>
    </div>
  );
}

function MembershipSkeleton() {
  return <div className="membership-card membership-skeleton" aria-label="Loading membership card"><div className="skeleton-line skeleton-short" /><div className="skeleton-line skeleton-title" /><div className="skeleton-line skeleton-points" /><div className="skeleton-line skeleton-progress" /></div>;
}

export default function ProfilePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [membership, setMembership] = useState<MembershipSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [membershipLoading, setMembershipLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user?.accountId) return;
    setLoading(true);
    setMembershipLoading(true);
    userApi.getUserById(user.accountId)
      .then((res: any) => {
        const nextProfile = res?.result ?? res?.data?.result ?? res?.data ?? res;
        setProfile(nextProfile);
        if (nextProfile?.avatarUrl) setPreview(nextProfile.avatarUrl);
      })
      .catch(() => setProfile(null))
      .finally(() => setLoading(false));
    loyaltyApi.getMyMembership()
      .then(setMembership)
      .catch(() => setMembership(null))
      .finally(() => setMembershipLoading(false));
  }, [user?.accountId]);

  useEffect(() => {
    if (!uploadSuccess) return;
    const timeoutId = window.setTimeout(() => setUploadSuccess(false), 3600);
    return () => window.clearTimeout(timeoutId);
  }, [uploadSuccess]);

  useEffect(() => {
    if (!uploadError) return;
    const timeoutId = window.setTimeout(() => setUploadError(null), 5200);
    return () => window.clearTimeout(timeoutId);
  }, [uploadError]);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user?.accountId) return;
    if (!file.type.startsWith("image/")) {
      setUploadError("Only image files are accepted (JPG, PNG, WEBP).");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setUploadError("File too large. Maximum size is 5 MB.");
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);
    setUploadError(null);
    setUploadSuccess(false);
    setUploading(true);
    try {
      const response: any = await userApi.uploadAvatar(user.accountId, file);
      const updated = response?.result ?? response?.data?.result ?? response?.data ?? response;
      let nextProfile = updated;
      if (!nextProfile?.avatarUrl) {
        const refreshedResponse: any = await userApi.getUserById(user.accountId);
        nextProfile = refreshedResponse?.result
          ?? refreshedResponse?.data?.result
          ?? refreshedResponse?.data
          ?? refreshedResponse;
      }
      const nextAvatarUrl = nextProfile?.avatarUrl ?? profile?.avatarUrl ?? null;
      if (nextAvatarUrl) setPreview(nextAvatarUrl);
      setProfile((previous) => previous
        ? { ...previous, ...nextProfile, avatarUrl: nextAvatarUrl ?? undefined }
        : nextProfile);
      publishProfileUpdated({ accountId: user.accountId, avatarUrl: nextAvatarUrl });
      setUploadSuccess(true);
    } catch (error: any) {
      setUploadError(error?.response?.data?.message || "Upload failed. Please try again.");
      setPreview(profile?.avatarUrl ?? null);
    } finally {
      URL.revokeObjectURL(objectUrl);
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  if (loading) {
    return (
      <div className="profile-loading"><div className="profile-spinner" /><style>{profileStyles}</style></div>
    );
  }

  const displayName = profile?.fullName || user?.username || "Member";
  const initials = displayName.slice(0, 2).toUpperCase();
  const progress = membership ? Math.max(0, Math.min(100, Number(membership.progressPercent) || 0)) : 0;
  const tier = membership?.membershipLevel ?? "MEMBER";

  return (
    <main className="profile-page">
      <style>{profileStyles}</style>
      <div className="profile-shell">
        <header className="profile-page-header">
          <div>
            <h1>My profile</h1>
            <p className="profile-page-subtitle">Your CinePrime identity, membership and rewards in one place.</p>
          </div>
        </header>

        <section className="profile-overview-grid">
          <article className="profile-card identity-card">
            <div className="identity-orbit orbit-one" />
            <div className="identity-orbit orbit-two" />
            <div className="avatar-wrap">
              <div className="avatar-frame">
                {preview ? <img src={preview} alt={`${displayName} avatar`} /> : <span>{initials}</span>}
                <button type="button" className="avatar-upload" disabled={uploading} onClick={() => !uploading && fileInputRef.current?.click()} aria-label="Upload avatar">
                  {uploading ? <span className="mini-spinner" /> : <Camera size={14} />}
                </button>
              </div>
              <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={handleFileChange} />
            </div>
            <div className="identity-copy">
              <h2>{displayName}</h2>
              <p>@{user?.username || "member"}</p>
              {!profile?.profileCompleted && (
                <button type="button" className="profile-completion-action" onClick={() => navigate("/profile-setup")}>
                  <Clock3 size={13} /> Complete your profile <ArrowUpRight size={13} />
                </button>
              )}
            </div>
            <div className="identity-divider" />
            <div className="identity-meta"><span>Member since</span><strong>{membership?.joinedAt ? formatDate(membership.joinedAt) : "CinePrime"}</strong></div>
            <p className="upload-help">JPG, PNG or WEBP · Maximum 5 MB</p>
          </article>

          {membershipLoading ? <MembershipSkeleton /> : membership ? (
            <article className={`membership-card tier-${tier.toLowerCase()}`}>
              <div className="membership-stars" />
              <div className="membership-card-top"><span className="membership-brand"><span className="brand-mark">C</span> CINEPRIME</span><span className="membership-chip"><Award size={13} /> MEMBER CARD</span></div>
              <div className="membership-card-content">
                <p className="membership-caption">CURRENT MEMBERSHIP</p>
                <div className="membership-tier-row"><h2>{tier}</h2><span className="membership-tier-dot" /></div>
                <p className="membership-spend">Lifetime spend <strong>{formatMoney(Number(membership.lifetimeSpend))}</strong></p>
              </div>
              <div className="membership-card-bottom">
                <div><span className="membership-caption">AVAILABLE POINTS</span><strong className="membership-points">{membership.availablePoints.toLocaleString("vi-VN")}</strong>{membership.pendingPoints > 0 && <small>{membership.pendingPoints.toLocaleString("vi-VN")} pending</small>}</div>
                {membership.nextLevel ? <div className="membership-next"><span>{Math.round(progress)}% to {membership.nextLevel}</span><div className="membership-progress"><span style={{ width: `${progress}%` }} /></div></div> : <span className="membership-max"><Sparkles size={14} /> Top tier reached</span>}
              </div>
              <ArrowUpRight className="membership-arrow" size={20} />
            </article>
          ) : (
            <article className="membership-card membership-unavailable"><Award size={28} /><h2>Membership card unavailable</h2><p>We could not load your rewards balance right now. Please try again shortly.</p></article>
          )}
        </section>

        <section className="profile-card profile-information-card">
          <div className="profile-information-heading">
            <div><h2>Profile information</h2><p>Contact and personal details linked to your CinePrime account.</p></div>
            <User size={19} />
          </div>
          <div className="profile-information-groups">
            <section className="profile-information-group" aria-labelledby="contact-information-title">
              <div className="profile-group-title"><Mail size={16} /><h3 id="contact-information-title">Contact</h3></div>
              <div className="detail-list"><InfoItem icon={Mail} label="Email" value={profile?.email} /><InfoItem icon={Phone} label="Phone number" value={profile?.phoneNumber} /><InfoItem icon={MapPin} label="Address" value={profile?.address} /></div>
            </section>
            <section className="profile-information-group" aria-labelledby="personal-information-title">
              <div className="profile-group-title"><User size={16} /><h3 id="personal-information-title">Personal</h3></div>
              <div className="detail-list"><InfoItem icon={User} label="Full name" value={profile?.fullName} /><InfoItem icon={Calendar} label="Date of birth" value={formatDate(profile?.dateOfBirth)} /><InfoItem icon={User} label="Gender" value={profile?.gender} /><InfoItem icon={CreditCard} label="National ID" value={maskIdentityCard(profile?.identityCard)} /></div>
            </section>
          </div>
        </section>
      </div>
      {uploadSuccess && <div className="profile-toast profile-toast-success" role="status" aria-live="polite"><CheckCircle size={18} /><div><strong>Profile photo updated</strong><span>Your new photo is now visible across CinePrime.</span></div></div>}
      {uploadError && <div className="profile-toast profile-toast-error" role="alert"><div><strong>Photo upload failed</strong><span>{uploadError}</span></div></div>}
    </main>
  );
}

const profileStyles = `
  @keyframes profile-spin { to { transform: rotate(360deg); } }
  @keyframes profile-shimmer { 0% { transform: translateX(-100%); } 100% { transform: translateX(100%); } }
  .profile-page { min-height:100vh; padding:92px 24px 72px; color:#eaf2ff; font-family:Inter, sans-serif; background:radial-gradient(circle at 78% 12%, rgba(37,99,235,.22), transparent 28%), radial-gradient(circle at 12% 28%, rgba(79,70,229,.12), transparent 30%), #030712; }
  .profile-shell { max-width:1080px; margin:0 auto; }
  .profile-page-header { margin-bottom:26px; }
  .profile-page-header h1 { margin:0 0 5px; font-size:32px; letter-spacing:-.04em; font-weight:800; color:#f8fbff; }
  .profile-page-subtitle { margin:0; color:#7e91ad; font-size:14px; }
  .profile-eyebrow { display:flex; align-items:center; gap:7px; margin:0; color:#60a5fa; font-size:10px; letter-spacing:.16em; font-weight:800; }
  .profile-overview-grid { display:grid; grid-template-columns:320px minmax(0,1fr); gap:18px; align-items:stretch; }
  .profile-card { position:relative; overflow:hidden; border:1px solid rgba(148,163,184,.15); border-radius:20px; background:rgba(15,23,42,.78); box-shadow:0 18px 55px rgba(0,0,0,.22); }
  .identity-card { display:flex; min-height:325px; flex-direction:column; align-items:center; padding:30px 24px 22px; text-align:center; }
  .identity-orbit { position:absolute; border:1px solid rgba(96,165,250,.12); border-radius:50%; pointer-events:none; }
  .orbit-one { width:270px; height:270px; top:-90px; right:-115px; }
  .orbit-two { width:220px; height:220px; bottom:-112px; left:-118px; }
  .avatar-wrap { position:relative; z-index:1; flex:0 0 auto; margin:4px 0 16px; }
  .avatar-frame { position:relative; display:grid; width:116px; min-width:116px; height:116px; min-height:116px; aspect-ratio:1 / 1; flex:0 0 116px; box-sizing:border-box; place-items:center; overflow:visible; border:0; border-radius:999px; background:linear-gradient(145deg,#1d4ed8,#312e81); box-shadow:0 0 0 4px rgba(59,130,246,.72), 0 0 0 10px rgba(59,130,246,.09), 0 14px 38px rgba(37,99,235,.30); }
  .avatar-frame img { display:block; width:100%; min-width:100%; height:100%; min-height:100%; aspect-ratio:1 / 1; border-radius:999px; object-fit:cover; object-position:center; }
  .avatar-frame > span { color:white; font-size:34px; font-weight:800; }
  .avatar-upload { position:absolute; right:-2px; bottom:2px; display:grid; width:30px; height:30px; place-items:center; border:2px solid #071225; border-radius:50%; background:#2563eb; color:white; cursor:pointer; box-shadow:0 5px 16px rgba(37,99,235,.45); }
  .avatar-upload:disabled { cursor:wait; opacity:.7; }
  .mini-spinner { width:13px; height:13px; border:2px solid rgba(255,255,255,.3); border-top-color:white; border-radius:50%; animation:profile-spin .7s linear infinite; }
  .identity-copy { position:relative; z-index:1; }
  .identity-copy h2 { margin:0; color:#f8fbff; font-size:19px; font-weight:800; }
  .identity-copy p { margin:4px 0 12px; color:#7690b2; font-size:13px; }
  .profile-completion-action { display:inline-flex; align-items:center; gap:6px; margin-top:2px; padding:0; border:0; background:transparent; color:#93c5fd; font:inherit; font-size:11px; font-weight:700; cursor:pointer; transition:color .16s ease; }
  .profile-completion-action:hover { color:#dbeafe; }
  .identity-divider { width:100%; margin:24px 0 14px; border-top:1px solid rgba(148,163,184,.12); }
  .identity-meta { display:flex; width:100%; justify-content:space-between; color:#6f85a3; font-size:11px; }
  .identity-meta strong { color:#bfdbfe; font-weight:700; }
  .upload-help { margin:16px 0 0; color:#526987; font-size:10px; }
  .membership-card { position:relative; display:flex; min-height:325px; flex-direction:column; justify-content:space-between; overflow:hidden; border:1px solid rgba(147,197,253,.30); border-radius:20px; padding:25px 28px; background:linear-gradient(132deg,#081a42 0%,#0e3b85 47%,#30236e 100%); box-shadow:0 22px 65px rgba(15,66,160,.25); }
  .membership-card:before { position:absolute; width:340px; height:340px; right:-130px; top:-145px; border:1px solid rgba(191,219,254,.16); border-radius:50%; content:""; }
  .membership-card:after { position:absolute; width:280px; height:280px; right:-85px; top:-115px; border:1px solid rgba(191,219,254,.12); border-radius:50%; content:""; }
  .membership-stars { position:absolute; inset:0; opacity:.55; background-image:radial-gradient(circle at 14% 30%, rgba(255,255,255,.8) 0 1px, transparent 1.5px),radial-gradient(circle at 32% 78%, rgba(191,219,254,.8) 0 1px, transparent 1.5px),radial-gradient(circle at 71% 58%, rgba(255,255,255,.75) 0 1px, transparent 1.5px),radial-gradient(circle at 88% 28%, rgba(191,219,254,.8) 0 1px, transparent 1.5px); background-size:150px 130px,190px 170px,230px 180px,180px 150px; }
  .membership-card > *:not(.membership-stars) { position:relative; z-index:1; }
  .membership-card-top, .membership-card-bottom, .membership-tier-row { display:flex; align-items:center; justify-content:space-between; gap:14px; }
  .membership-brand { display:inline-flex; align-items:center; gap:8px; color:#dbeafe; font-size:12px; letter-spacing:.15em; font-weight:800; }
  .brand-mark { display:grid; width:23px; height:23px; place-items:center; border:1px solid rgba(191,219,254,.5); border-radius:50%; color:#bfdbfe; font-size:12px; }
  .membership-chip { display:inline-flex; align-items:center; gap:6px; border:1px solid rgba(191,219,254,.22); border-radius:999px; padding:5px 9px; color:#bfdbfe; font-size:9px; letter-spacing:.08em; font-weight:700; }
  .membership-caption { margin:0; color:#a9c7ef; font-size:10px; letter-spacing:.15em; font-weight:700; }
  .membership-card-content { margin-top:34px; }
  .membership-tier-row { justify-content:flex-start; margin-top:7px; }
  .membership-tier-row h2 { margin:0; color:#f8fbff; font-size:37px; letter-spacing:.08em; font-weight:850; }
  .membership-tier-dot { width:9px; height:9px; border-radius:50%; background:#bfdbfe; box-shadow:0 0 16px rgba(191,219,254,.85); }
  .membership-spend { margin:11px 0 0; color:#a8c2e4; font-size:12px; }
  .membership-spend strong { margin-left:5px; color:white; font-weight:700; }
  .membership-card-bottom { align-items:flex-end; margin-top:30px; }
  .membership-points { display:block; margin-top:5px; color:white; font-size:27px; letter-spacing:-.03em; }
  .membership-card-bottom small { display:block; margin-top:3px; color:#a8c2e4; font-size:10px; }
  .membership-next { width:190px; color:#dbeafe; font-size:10px; text-align:right; }
  .membership-progress { height:6px; margin-top:8px; overflow:hidden; border-radius:99px; background:rgba(255,255,255,.16); }
  .membership-progress span { display:block; height:100%; border-radius:inherit; background:#bfdbfe; box-shadow:0 0 13px rgba(191,219,254,.6); }
  .membership-max { display:inline-flex; align-items:center; gap:6px; color:#dbeafe; font-size:11px; }
  .membership-arrow { position:absolute; right:25px; bottom:22px; color:rgba(219,234,254,.58); }
  .tier-silver { background:linear-gradient(132deg,#172b49 0%,#42688e 50%,#34436b 100%); }
  .tier-gold { background:linear-gradient(132deg,#3b270c 0%,#926d22 49%,#4d3278 100%); border-color:rgba(253,230,138,.35); }
  .tier-platinum { background:linear-gradient(132deg,#18253d 0%,#596b9e 50%,#70458d 100%); border-color:rgba(224,231,255,.4); }
  .membership-skeleton { border-color:rgba(148,163,184,.15); background:#0f172a; }
  .skeleton-line { position:relative; overflow:hidden; border-radius:7px; background:rgba(148,163,184,.15); }
  .skeleton-line:after { position:absolute; inset:0; background:linear-gradient(90deg,transparent,rgba(255,255,255,.08),transparent); content:""; animation:profile-shimmer 1.5s infinite; }
  .skeleton-short { width:130px; height:12px; }
  .skeleton-title { width:180px; height:40px; margin-top:42px; }
  .skeleton-points { width:120px; height:28px; margin-top:48px; }
  .skeleton-progress { width:55%; height:6px; margin-top:18px; }
  .membership-unavailable { align-items:flex-start; justify-content:center; gap:11px; color:#8fa6c4; }
  .membership-unavailable h2 { margin:0; color:#e5efff; font-size:20px; }
  .membership-unavailable p { max-width:360px; margin:0; color:#8fa6c4; font-size:13px; line-height:1.6; }
  .profile-information-card { margin-top:18px; padding:24px 25px 8px; }
  .profile-information-heading { display:flex; align-items:flex-start; justify-content:space-between; gap:15px; padding-bottom:18px; border-bottom:1px solid rgba(148,163,184,.12); color:#60a5fa; }
  .profile-information-heading h2 { margin:0; color:#eff6ff; font-size:18px; }
  .profile-information-heading p { margin:6px 0 0; color:#6f85a3; font-size:12px; }
  .profile-information-groups { display:grid; grid-template-columns:1fr 1fr; gap:0; }
  .profile-information-group { min-width:0; padding:20px 24px 0 0; }
  .profile-information-group + .profile-information-group { padding-right:0; padding-left:24px; border-left:1px solid rgba(148,163,184,.12); }
  .profile-group-title { display:flex; align-items:center; gap:8px; margin-bottom:4px; color:#60a5fa; }
  .profile-group-title h3 { margin:0; color:#bfdbfe; font-size:12px; letter-spacing:.1em; text-transform:uppercase; }
  .detail-list { display:grid; grid-template-columns:1fr; }
  .profile-info-item { display:flex; align-items:center; gap:12px; min-width:0; padding:14px 0; border-bottom:1px solid rgba(148,163,184,.10); }
  .profile-info-icon { display:grid; width:34px; height:34px; flex:0 0 auto; place-items:center; border:1px solid rgba(96,165,250,.18); border-radius:9px; background:rgba(37,99,235,.1); color:#60a5fa; }
  .profile-info-copy { display:flex; min-width:0; flex-direction:column; gap:3px; }
  .profile-info-label { color:#6f85a3; font-size:10px; letter-spacing:.1em; font-weight:700; text-transform:uppercase; }
  .profile-info-value { overflow:hidden; color:#e5efff; font-size:13px; text-overflow:ellipsis; white-space:nowrap; }
  .profile-info-empty { color:#526987; font-style:italic; }
  .profile-toast { position:fixed; z-index:100; right:24px; bottom:24px; display:flex; width:min(360px,calc(100vw - 32px)); box-sizing:border-box; align-items:flex-start; gap:11px; padding:14px 16px; border:1px solid rgba(96,165,250,.28); border-radius:14px; background:rgba(7,18,37,.96); box-shadow:0 18px 55px rgba(0,0,0,.4); backdrop-filter:blur(18px); }
  .profile-toast strong, .profile-toast span { display:block; }
  .profile-toast strong { color:#eff6ff; font-size:13px; }
  .profile-toast span { margin-top:3px; color:#8fa6c4; font-size:11px; line-height:1.45; }
  .profile-toast-success { color:#34d399; }
  .profile-toast-error { border-color:rgba(248,113,113,.28); color:#f87171; }
  .profile-loading { min-height:100vh; display:grid; place-items:center; background:#030712; }
  .profile-spinner { width:34px; height:34px; border:3px solid rgba(96,165,250,.18); border-top-color:#60a5fa; border-radius:50%; animation:profile-spin .8s linear infinite; }
  @media (max-width: 820px) { .profile-page { padding:78px 16px 50px; } .profile-overview-grid, .profile-information-groups { grid-template-columns:1fr; } .profile-information-group { padding-right:0; } .profile-information-group + .profile-information-group { padding-left:0; border-left:0; border-top:1px solid rgba(148,163,184,.12); } .identity-card { min-height:0; } .membership-card { min-height:300px; } }
  @media (max-width: 480px) { .profile-page-header h1 { font-size:27px; } .membership-card { padding:22px 19px; } .membership-card-bottom { align-items:flex-start; flex-direction:column; } .membership-next { width:100%; text-align:left; } .membership-arrow { display:none; } }
`;
