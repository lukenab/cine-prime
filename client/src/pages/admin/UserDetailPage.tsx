import { useState, useEffect } from "react";
import { useParams, useNavigate, useOutletContext } from "react-router-dom";
import { ArrowLeft, User, Mail, Phone, MapPin, CreditCard, Calendar, Shield, Clock, Copy, Check } from "lucide-react";
import { authApi } from "../../api/authApi";
import { userApi } from "../../api/userApi";

const avatarGradients = [
  "linear-gradient(135deg, #3b82f6, #6366f1)",
  "linear-gradient(135deg, #10b981, #059669)",
  "linear-gradient(135deg, #f59e0b, #ef4444)",
  "linear-gradient(135deg, #8b5cf6, #ec4899)",
  "linear-gradient(135deg, #06b6d4, #3b82f6)",
  "linear-gradient(135deg, #f97316, #f59e0b)",
];

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 py-3" style={{ borderBottom: "1px solid var(--border-color)" }}>
      <div className="mt-0.5 flex-shrink-0" style={{ color: "var(--text-sub)" }}>{icon}</div>
      <div className="min-w-0 flex-1">
        <p style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-sub)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "2px" }}>{label}</p>
        <p style={{ fontSize: "14px", color: "var(--text-main)", wordBreak: "break-word" }}>{value || "—"}</p>
      </div>
    </div>
  );
}

function CopyableId({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const truncated = value.length > 20 ? `${value.slice(0, 8)}...${value.slice(-5)}` : value;

  return (
    <div className="flex items-start gap-3 py-3" style={{ borderBottom: "1px solid var(--border-color)" }}>
      <div className="mt-0.5 flex-shrink-0" style={{ color: "var(--text-sub)" }}>{icon}</div>
      <div className="min-w-0 flex-1">
        <p style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-sub)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "2px" }}>{label}</p>
        <div className="flex items-center gap-2">
          <code style={{ fontSize: "13px", color: "var(--text-main)", fontFamily: "monospace" }}>{truncated}</code>
          <button
            onClick={handleCopy}
            className="flex-shrink-0 w-6 h-6 rounded-md flex items-center justify-center transition-colors hover:bg-gray-100"
            style={{ color: copied ? "#10b981" : "var(--text-sub)" }}
            title="Copy full ID"
          >
            {copied ? <Check size={12} /> : <Copy size={12} />}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function UserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isDarkMode } = useOutletContext<{ isDarkMode: boolean }>();

  const [loading, setLoading] = useState(true);
  const [account, setAccount] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    const fetchData = async () => {
      try {
        setLoading(true);
        const [authRes, userRes]: [any, any] = await Promise.all([
          authApi.getAccountById(id),
          userApi.getUserById(id).catch(() => ({ result: null })),
        ]);
        setAccount(authRes.result);
        setProfile(userRes.result);
      } catch (err: any) {
        setError(err?.response?.data?.message || "Failed to load user details.");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  const displayName = profile?.fullName || account?.username || "Unknown";
  const avatarGradient = avatarGradients[(id?.charCodeAt(0) ?? 0) % avatarGradients.length];
  const initials = displayName.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2);
  const isActive = profile?.isActive !== false;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate("/admin/users")}
          className="w-9 h-9 rounded-xl flex items-center justify-center border transition-colors hover:opacity-80"
          style={{ background: "var(--bg-card)", borderColor: "var(--border-color)", color: "var(--text-main)" }}
        >
          <ArrowLeft size={16} />
        </button>
        <div>
          <h1 style={{ fontSize: "22px", fontWeight: 600, color: "var(--text-main)", letterSpacing: "-0.01em" }}>
            User Detail
          </h1>
          <p style={{ fontSize: "13px", color: "var(--text-sub)" }}>View detailed account and profile information</p>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex justify-center items-center py-24">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div className="rounded-2xl border p-8 text-center" style={{ background: "var(--bg-card)", borderColor: "var(--border-color)" }}>
          <p style={{ color: "#ef4444", fontSize: "14px" }}>{error}</p>
          <button onClick={() => navigate("/admin/users")} className="mt-4 text-sm underline" style={{ color: "var(--text-sub)" }}>
            Back to Users
          </button>
        </div>
      )}

      {/* Content */}
      {!loading && !error && account && (
        <div className="grid gap-5" style={{ gridTemplateColumns: "280px 1fr" }}>

          {/* Left — Avatar & status card */}
          <div className="flex flex-col gap-4">
            <div
              className="rounded-2xl border p-6 flex flex-col items-center text-center"
              style={{ background: "var(--bg-card)", borderColor: "var(--border-color)" }}
            >
              {profile?.avatarUrl ? (
                <img src={profile.avatarUrl} alt={displayName} className="w-20 h-20 rounded-full object-cover mb-4" />
              ) : (
                <div
                  className="w-20 h-20 rounded-full flex items-center justify-center text-white text-xl mb-4"
                  style={{ background: avatarGradient, fontWeight: 700 }}
                >
                  {initials}
                </div>
              )}
              <p style={{ fontSize: "16px", fontWeight: 600, color: "var(--text-main)", marginBottom: "4px" }}>{displayName}</p>
              <p style={{ fontSize: "13px", color: "var(--text-sub)", marginBottom: "12px" }}>@{account.username}</p>

              {/* Status badge */}
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium mb-4 ${isActive ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${isActive ? "bg-emerald-500" : "bg-gray-400"}`} />
                {isActive ? "Active" : "Inactive"}
              </span>

              {/* Roles */}
              <div className="w-full">
                <p style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-sub)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "8px" }}>Roles</p>
                <div className="flex flex-wrap gap-1.5 justify-center">
                  {account.roles?.length > 0 ? account.roles.map((r: any) => (
                    <span
                      key={r.roleName}
                      className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg border text-xs font-medium"
                      style={{
                        background: r.roleName === "ADMIN" ? "rgba(139,92,246,0.08)" : "rgba(16,185,129,0.08)",
                        color: r.roleName === "ADMIN" ? "#7c3aed" : "#059669",
                        borderColor: r.roleName === "ADMIN" ? "rgba(139,92,246,0.2)" : "rgba(16,185,129,0.2)",
                      }}
                    >
                      <Shield size={10} />
                      {r.roleName}
                    </span>
                  )) : (
                    <span style={{ fontSize: "13px", color: "var(--text-sub)" }}>No roles assigned</span>
                  )}
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex flex-col gap-2">
              <button
                onClick={() => navigate(`/admin/users/edit/${id}`)}
                className="w-full py-2.5 rounded-xl text-sm font-medium text-white transition-colors hover:opacity-90"
                style={{ background: isDarkMode ? "#3b82f6" : "#2563eb" }}
              >
                Edit User
              </button>
              <button
                onClick={() => navigate("/admin/users")}
                className="w-full py-2.5 rounded-xl border text-sm font-medium transition-colors hover:opacity-80"
                style={{ color: "var(--text-main)", borderColor: "var(--border-color)", background: "transparent" }}
              >
                Back to List
              </button>
            </div>
          </div>

          {/* Right — Info sections */}
          <div className="flex flex-col gap-5">

            {/* Account Info */}
            <div className="rounded-2xl border p-6" style={{ background: "var(--bg-card)", borderColor: "var(--border-color)" }}>
              <h2 style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-main)", marginBottom: "4px" }}>Account Information</h2>
              <p style={{ fontSize: "12px", color: "var(--text-sub)", marginBottom: "16px" }}>Authentication & access data from Auth Service</p>
              <CopyableId icon={<User size={15} />} label="Account ID" value={account.accountId} />
              <InfoRow icon={<User size={15} />} label="Username" value={account.username} />
              <InfoRow icon={<Mail size={15} />} label="Email" value={account.email} />
              <InfoRow
                icon={<Clock size={15} />}
                label="Created At"
                value={account.createdAt ? new Date(account.createdAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" }) : "—"}
              />
            </div>

            {/* Profile Info */}
            <div className="rounded-2xl border p-6" style={{ background: "var(--bg-card)", borderColor: "var(--border-color)" }}>
              <h2 style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-main)", marginBottom: "4px" }}>Profile Information</h2>
              <p style={{ fontSize: "12px", color: "var(--text-sub)", marginBottom: "16px" }}>
                {profile ? "Personal data from User Service" : "No profile found — user may not have completed registration."}
              </p>

              {profile ? (
                <>
                  <InfoRow icon={<User size={15} />} label="Full Name" value={profile.fullName} />
                  <InfoRow icon={<Mail size={15} />} label="Email" value={profile.email ?? account?.email} />
                  <InfoRow icon={<Phone size={15} />} label="Phone Number" value={profile.phoneNumber} />
                  <InfoRow icon={<Calendar size={15} />} label="Date of Birth" value={profile.dateOfBirth ?? "—"} />
                  <InfoRow icon={<User size={15} />} label="Gender" value={profile.gender} />
                  <InfoRow icon={<MapPin size={15} />} label="Address" value={profile.address} />
                  <InfoRow icon={<CreditCard size={15} />} label="Identity Card" value={profile.identityCard} />
                  <InfoRow
                    icon={<Clock size={15} />}
                    label="Last Updated"
                    value={profile.updatedAt ? new Date(profile.updatedAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" }) : "Never"}
                  />
                </>
              ) : (
                <p style={{ fontSize: "13px", color: "var(--text-sub)", fontStyle: "italic" }}>
                  Profile data unavailable.
                </p>
              )}
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
