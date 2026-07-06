import { useState, useEffect, useRef } from "react";
import { Camera, User, Mail, Phone, CreditCard, Calendar, MapPin, Shield, CheckCircle } from "lucide-react";
import { userApi } from "../../api/userApi";
import { useAuth } from "../../context/AuthContext";

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
  return raw.slice(0, 4) + "••••" + raw.slice(-4);
}

function formatDate(val?: string): string {
  if (!val) return "—";
  const d = new Date(val);
  return d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function InfoRow({ icon: Icon, label, value }: { icon: any; label: string; value?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 14, padding: "14px 0", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
      <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(59,130,246,0.1)", border: "1px solid rgba(59,130,246,0.18)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <Icon size={16} color="#60a5fa" />
      </div>
      <div>
        <p style={{ margin: 0, fontSize: 11, fontWeight: 600, letterSpacing: "0.07em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)" }}>{label}</p>
        <p style={{ margin: "3px 0 0", fontSize: 14, color: value ? "#e2e8f0" : "rgba(255,255,255,0.2)", fontStyle: value ? "normal" : "italic" }}>
          {value || "Not provided"}
        </p>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user?.accountId) return;
    setLoading(true);
    userApi.getUserById(user.accountId)
      .then((res: any) => {
        const p = res?.result ?? res?.data?.result ?? res?.data ?? res;
        setProfile(p);
        if (p?.avatarUrl) setPreview(p.avatarUrl);
      })
      .catch(() => setProfile(null))
      .finally(() => setLoading(false));
  }, [user?.accountId]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user?.accountId) return;

    // Client-side validation
    if (!file.type.startsWith("image/")) {
      setUploadError("Only image files are accepted (JPG, PNG, WEBP).");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setUploadError("File too large. Maximum size is 5 MB.");
      return;
    }

    // Optimistic preview
    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);
    setUploadError(null);
    setUploadSuccess(false);
    setUploading(true);

    try {
      const res: any = await userApi.uploadAvatar(user.accountId, file);
      const updated = res?.result ?? res?.data?.result ?? res?.data ?? res;
      if (updated?.avatarUrl) setPreview(updated.avatarUrl);
      setProfile(prev => prev ? { ...prev, avatarUrl: updated?.avatarUrl } : prev);
      setUploadSuccess(true);
      setTimeout(() => setUploadSuccess(false), 3000);
    } catch (err: any) {
      const msg = err?.response?.data?.message || "Upload failed. Please try again.";
      setUploadError(msg);
      // Revert preview on failure
      setPreview(profile?.avatarUrl ?? null);
    } finally {
      setUploading(false);
      // Reset input so same file can be re-selected
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "#050505", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 40, height: 40, borderRadius: "50%", border: "3px solid rgba(59,130,246,0.2)", borderTopColor: "#3b82f6", animation: "spin 0.8s linear infinite" }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    );
  }

  const initials = (profile?.fullName || user?.username || "?").slice(0, 2).toUpperCase();

  return (
    <div style={{ minHeight: "100vh", background: "#050505", paddingTop: 80, paddingBottom: 60, fontFamily: "'Inter', sans-serif" }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } } @keyframes fadeIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }`}</style>

      <div style={{ maxWidth: 680, margin: "0 auto", padding: "0 20px", animation: "fadeIn 0.3s ease both" }}>

        {/* ── Header card ── */}
        <div style={{
          background: "linear-gradient(145deg, #0f1117 0%, #111318 100%)",
          border: "1px solid rgba(255,255,255,0.07)",
          borderRadius: 20, padding: "32px 32px 28px",
          marginBottom: 16, position: "relative", overflow: "hidden",
        }}>
          {/* Accent gradient top */}
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: "linear-gradient(90deg,#1d4ed8,#3b82f6,#60a5fa)" }} />

          <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
            {/* ── Avatar with upload overlay ── */}
            <div style={{ position: "relative", flexShrink: 0 }}>
              <div
                style={{
                  width: 96, height: 96, borderRadius: "50%",
                  border: "2px solid rgba(59,130,246,0.4)",
                  overflow: "hidden", position: "relative",
                  boxShadow: "0 0 24px rgba(59,130,246,0.2)",
                }}
              >
                {preview ? (
                  <img src={preview} alt="avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  <div style={{ width: "100%", height: "100%", background: "linear-gradient(135deg,#1e3a8a,#2563eb)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <span style={{ color: "#fff", fontWeight: 800, fontSize: 28 }}>{initials}</span>
                  </div>
                )}

                {/* Upload overlay — appears on hover */}
                <div
                  onClick={() => !uploading && fileInputRef.current?.click()}
                  style={{
                    position: "absolute", inset: 0,
                    background: uploading ? "rgba(0,0,0,0.55)" : "rgba(0,0,0,0)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    cursor: uploading ? "wait" : "pointer",
                    transition: "background 0.2s",
                  }}
                  onMouseEnter={e => { if (!uploading) e.currentTarget.style.background = "rgba(0,0,0,0.5)"; }}
                  onMouseLeave={e => { if (!uploading) e.currentTarget.style.background = "rgba(0,0,0,0)"; }}
                >
                  {uploading ? (
                    <div style={{ width: 22, height: 22, borderRadius: "50%", border: "2.5px solid rgba(255,255,255,0.25)", borderTopColor: "#fff", animation: "spin 0.75s linear infinite" }} />
                  ) : (
                    <Camera size={20} color="#fff" style={{ opacity: 0, transition: "opacity 0.2s" }} className="avatar-cam" />
                  )}
                </div>
              </div>

              {/* Upload badge */}
              <button
                onClick={() => !uploading && fileInputRef.current?.click()}
                disabled={uploading}
                style={{
                  position: "absolute", bottom: 0, right: 0,
                  width: 28, height: 28, borderRadius: "50%",
                  background: uploading ? "rgba(59,130,246,0.5)" : "#2563eb",
                  border: "2px solid #050505",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: uploading ? "wait" : "pointer",
                  boxShadow: "0 2px 8px rgba(37,99,235,0.5)",
                  transition: "background 0.2s",
                }}
              >
                <Camera size={13} color="#fff" />
              </button>

              <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleFileChange} />
            </div>

            {/* ── Name + status ── */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <h1 style={{ margin: "0 0 4px", fontSize: 22, fontWeight: 800, color: "#f1f5f9", letterSpacing: "-0.02em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {profile?.fullName || user?.username || "—"}
              </h1>
              <p style={{ margin: "0 0 10px", fontSize: 13, color: "rgba(255,255,255,0.35)" }}>
                @{user?.username}
              </p>

              {profile?.profileCompleted ? (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, fontWeight: 600, color: "#4ade80", background: "rgba(74,222,128,0.1)", border: "1px solid rgba(74,222,128,0.2)", borderRadius: 99, padding: "3px 10px" }}>
                  <CheckCircle size={12} /> Profile complete
                </span>
              ) : (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, fontWeight: 600, color: "#fb923c", background: "rgba(251,146,60,0.1)", border: "1px solid rgba(251,146,60,0.2)", borderRadius: 99, padding: "3px 10px" }}>
                  <Shield size={12} /> Profile incomplete
                </span>
              )}
            </div>
          </div>

          {/* Upload feedback */}
          {uploadSuccess && (
            <div style={{ marginTop: 14, padding: "10px 14px", background: "rgba(74,222,128,0.08)", border: "1px solid rgba(74,222,128,0.2)", borderRadius: 10, fontSize: 13, color: "#4ade80", display: "flex", alignItems: "center", gap: 8 }}>
              <CheckCircle size={14} /> Avatar updated successfully
            </div>
          )}
          {uploadError && (
            <div style={{ marginTop: 14, padding: "10px 14px", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 10, fontSize: 13, color: "#f87171" }}>
              {uploadError}
            </div>
          )}

          <p style={{ margin: "18px 0 0", fontSize: 11.5, color: "rgba(255,255,255,0.18)" }}>
            Click the camera icon to upload a new avatar · JPG, PNG, WEBP · Max 5 MB
          </p>
        </div>

        {/* ── Info card ── */}
        <div style={{ background: "#0f1117", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 20, padding: "8px 28px 4px" }}>
          <InfoRow icon={Mail}     label="Email"          value={profile?.email} />
          <InfoRow icon={User}     label="Full Name"      value={profile?.fullName} />
          <InfoRow icon={Phone}    label="Phone"          value={profile?.phoneNumber} />
          <InfoRow icon={Calendar} label="Date of Birth"  value={formatDate(profile?.dateOfBirth)} />
          <InfoRow icon={User}     label="Gender"         value={profile?.gender} />
          <InfoRow icon={CreditCard} label="National ID"  value={maskIdentityCard(profile?.identityCard)} />
          <div style={{ borderBottom: "none" }}>
            <InfoRow icon={MapPin}   label="Address"        value={profile?.address} />
          </div>
        </div>

      </div>

      {/* Hover effect for camera icon */}
      <style>{`.avatar-cam { opacity: 0 !important; } div:hover > .avatar-cam { opacity: 1 !important; }`}</style>
    </div>
  );
}
