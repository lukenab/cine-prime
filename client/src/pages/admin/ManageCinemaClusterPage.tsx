import { useState, useEffect, useCallback, useRef } from "react";
import {
  Plus, Search, RefreshCw, AlertCircle, MapPin, Building2,
  Armchair, X, Edit2, Trash2, Phone, CheckCircle, XCircle,
  Clock, SendHorizonal,
} from "lucide-react";
import { useOutletContext } from "react-router-dom";
import {
  movieApi,
  type ClusterResponse,
  type CreateClusterPayload,
  type ClusterStatus,
} from "../../api/movieApi";
import { useRole } from "../../hooks/useRole";

// ── Provinces list ────────────────────────────────────────────────────────────

const PROVINCES = [
  "Hà Nội", "TP. Hồ Chí Minh", "Đà Nẵng", "Cần Thơ", "Hải Phòng",
  "Biên Hòa", "Nha Trang", "Huế", "Vũng Tàu", "Quy Nhơn",
  "Bình Dương", "Long An", "Đồng Nai", "Bà Rịa - Vũng Tàu",
  "Thanh Hóa", "Nghệ An", "Bình Định", "Khánh Hòa", "Lâm Đồng",
  "Khác",
];

// ── Nominatim (OpenStreetMap) Address Autocomplete ────────────────────────────

type NominatimResult = {
  display_name: string;
  lat: string;
  lon: string;
  address?: {
    city?: string;
    state?: string;
    county?: string;
    town?: string;
    village?: string;
  };
};

const NOMINATIM_PROVINCE_MAP: Record<string, string> = {
  "Hồ Chí Minh": "TP. Hồ Chí Minh",
  "Thành phố Hồ Chí Minh": "TP. Hồ Chí Minh",
  "Hà Nội": "Hà Nội",
  "Thành phố Hà Nội": "Hà Nội",
  "Đà Nẵng": "Đà Nẵng",
  "Thành phố Đà Nẵng": "Đà Nẵng",
  "Cần Thơ": "Cần Thơ",
  "Thành phố Cần Thơ": "Cần Thơ",
  "Hải Phòng": "Hải Phòng",
  "Thành phố Hải Phòng": "Hải Phòng",
  "Đồng Nai": "Đồng Nai",
  "Tỉnh Đồng Nai": "Đồng Nai",
  "Bình Dương": "Bình Dương",
  "Tỉnh Bình Dương": "Bình Dương",
  "Khánh Hòa": "Khánh Hòa",
  "Tỉnh Khánh Hòa": "Khánh Hòa",
  "Bà Rịa - Vũng Tàu": "Bà Rịa - Vũng Tàu",
  "Bà Rịa–Vũng Tàu": "Bà Rịa - Vũng Tàu",
  "Tỉnh Bà Rịa - Vũng Tàu": "Bà Rịa - Vũng Tàu",
  "Thanh Hóa": "Thanh Hóa",
  "Tỉnh Thanh Hóa": "Thanh Hóa",
  "Nghệ An": "Nghệ An",
  "Tỉnh Nghệ An": "Nghệ An",
  "Bình Định": "Bình Định",
  "Tỉnh Bình Định": "Bình Định",
  "Lâm Đồng": "Lâm Đồng",
  "Tỉnh Lâm Đồng": "Lâm Đồng",
  "Long An": "Long An",
  "Tỉnh Long An": "Long An",
  "Biên Hòa": "Biên Hòa",
  "Nha Trang": "Nha Trang",
  "Huế": "Huế",
  "Tỉnh Thừa Thiên Huế": "Huế",
  "Thừa Thiên Huế": "Huế",
  "Vũng Tàu": "Vũng Tàu",
  "Quy Nhơn": "Quy Nhơn",
};

function detectProvince(address: NominatimResult["address"]): string | null {
  if (!address) return null;
  const candidates = [address.city, address.state, address.county, address.town, address.village];
  for (const c of candidates) {
    if (!c) continue;
    if (NOMINATIM_PROVINCE_MAP[c]) return NOMINATIM_PROVINCE_MAP[c];
    const match = PROVINCES.find((p) => c.includes(p) || p.includes(c));
    if (match) return match;
  }
  return null;
}

type PlacesInputProps = {
  value: string;
  onChange: (address: string, lat?: number, lng?: number) => void;
  onProvinceDetected?: (province: string) => void;
  style?: React.CSSProperties;
  className?: string;
  required?: boolean;
};

function PlacesAddressInput({ value, onChange, onProvinceDetected, style, className, required }: PlacesInputProps) {
  const [suggestions, setSuggestions] = useState<NominatimResult[]>([]);
  const [showDrop, setShowDrop] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setShowDrop(false);
      }
    };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, []);

  const fetchSuggestions = async (input: string) => {
    if (!input || input.length < 3) { setSuggestions([]); setShowDrop(false); return; }
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(input)}&countrycodes=vn&format=json&limit=5&addressdetails=1`,
        { headers: { "Accept-Language": "vi", "User-Agent": "CinePrime/1.0" } }
      );
      const data: NominatimResult[] = await res.json();
      setSuggestions(data);
      setShowDrop(data.length > 0);
    } catch {
      setSuggestions([]);
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(e.target.value), 500);
  };

  const handleSelect = (s: NominatimResult) => {
    setShowDrop(false);
    setSuggestions([]);
    onChange(s.display_name, parseFloat(s.lat), parseFloat(s.lon));
    if (onProvinceDetected) {
      const province = detectProvince(s.address);
      if (province) onProvinceDetected(province);
    }
  };

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      <input
        type="text" value={value}
        onChange={handleInput}
        onFocus={() => suggestions.length > 0 && setShowDrop(true)}
        required={required} maxLength={255}
        placeholder="Start typing an address…"
        className={className} style={style}
      />
      {showDrop && suggestions.length > 0 && (
        <ul style={{
          position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0,
          zIndex: 9999, margin: 0, padding: 0, listStyle: "none",
          background: "var(--bg-main)",
          border: "1px solid var(--border-color)",
          borderRadius: "12px", overflow: "hidden",
          boxShadow: "0 8px 24px rgba(0,0,0,0.14)",
        }}>
          {suggestions.map((s, i) => (
            <li key={i}>
              <button
                type="button"
                onMouseDown={() => handleSelect(s)}
                style={{
                  width: "100%", padding: "9px 14px", textAlign: "left",
                  background: "transparent", border: "none",
                  borderBottom: i < suggestions.length - 1
                    ? "1px solid var(--border-color)" : "none",
                  cursor: "pointer", fontSize: "13px",
                  color: "var(--text-main)",
                  display: "flex", alignItems: "center", gap: "8px",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(59,130,246,0.08)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                <MapPin size={11} style={{ color: "#3b82f6", flexShrink: 0 }} />
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {s.display_name}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Status config ─────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<ClusterStatus, { label: string; icon: React.ElementType; color: string; bg: string }> = {
  DRAFT:          { label: "Draft",          icon: Clock,       color: "#6b7280", bg: "rgba(107,114,128,0.10)" },
  PENDING_REVIEW: { label: "Pending Review", icon: Clock,       color: "#d97706", bg: "rgba(245,158,11,0.10)"  },
  ACTIVE:         { label: "Active",         icon: CheckCircle, color: "#10b981", bg: "rgba(16,185,129,0.10)"  },
  INACTIVE:       { label: "Inactive",       icon: XCircle,     color: "#ef4444", bg: "rgba(239,68,68,0.10)"   },
};

// ── InputModal (for reject note) ──────────────────────────────────────────────

function InputModal({
  title, label, placeholder, confirmLabel, confirmColor, onConfirm, onCancel, icon: Icon,
}: {
  title: string; label: string; placeholder: string;
  confirmLabel: string; confirmColor: string;
  onConfirm: (value: string) => void; onCancel: () => void;
  icon: React.ElementType;
}) {
  const [value, setValue] = useState("");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.45)" }} onClick={onCancel}>
      <div className="rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4" style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-center w-12 h-12 rounded-full mx-auto mb-4" style={{ background: `${confirmColor}18` }}>
          <Icon size={22} style={{ color: confirmColor }} />
        </div>
        <h3 style={{ fontSize: "16px", fontWeight: 600, color: "var(--text-main)", textAlign: "center", marginBottom: "16px" }}>{title}</h3>
        <div className="mb-4">
          <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-sub)", display: "block", marginBottom: "6px" }}>{label}</label>
          <textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={placeholder}
            rows={3}
            autoFocus
            className="w-full px-3 py-2.5 rounded-xl border outline-none focus:ring-2 resize-none"
            style={{ fontSize: "13px", background: "var(--bg-main)", color: "var(--text-main)", borderColor: "var(--border-color)" }}
          />
        </div>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 py-2.5 rounded-xl border text-sm font-medium hover:opacity-80" style={{ color: "var(--text-main)", borderColor: "var(--border-color)", background: "transparent" }}>
            Cancel
          </button>
          <button
            onClick={() => value.trim() ? onConfirm(value.trim()) : null}
            disabled={!value.trim()}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: confirmColor }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Action button ─────────────────────────────────────────────────────────────

function ActionBtn({ icon: Icon, title, onClick, color = "var(--text-sub)" }: {
  icon: React.ElementType; title: string; onClick: () => void; color?: string;
}) {
  return (
    <button
      onClick={onClick} title={title}
      className="w-9 h-9 rounded-lg flex items-center justify-center transition-colors cluster-action-btn flex-shrink-0"
      style={{ color }}
    >
      <Icon size={16} />
    </button>
  );
}

// ── Status-aware action buttons ───────────────────────────────────────────────

function ClusterActions({
  cluster, onEdit, onDelete, onSubmit, onApprove, onRejectClick,
}: {
  cluster: ClusterResponse;
  onEdit: () => void; onDelete: () => void;
  onSubmit: () => void; onApprove: () => void; onRejectClick: () => void;
}) {
  const { can, isAdmin } = useRole();
  const s = cluster.status;

  return (
    <div className="flex items-center justify-end gap-0.5 opacity-0 cluster-actions transition-opacity">
      {s === "DRAFT" && <>
        {can.submit  && <ActionBtn icon={SendHorizonal} title="Submit for review" onClick={onSubmit}  color="#2563eb" />}
        {can.edit    && <ActionBtn icon={Edit2}         title="Edit"              onClick={onEdit}              />}
        {isAdmin     && <ActionBtn icon={Trash2}        title="Delete"            onClick={onDelete}  color="#ef4444" />}
      </>}
      {s === "PENDING_REVIEW" && <>
        {can.approve && <ActionBtn icon={CheckCircle} title="Approve → Active" onClick={onApprove}    color="#059669" />}
        {can.reject  && <ActionBtn icon={XCircle}     title="Reject"           onClick={onRejectClick} color="#dc2626" />}
      </>}
      {(s === "ACTIVE" || s === "INACTIVE") && <>
        {isAdmin && <ActionBtn icon={Edit2}  title="Edit"   onClick={onEdit}   />}
        {isAdmin && <ActionBtn icon={Trash2} title="Delete" onClick={onDelete} color="#ef4444" />}
      </>}
    </div>
  );
}

// ── Cluster Modal ─────────────────────────────────────────────────────────────

type ModalMode = "create" | "edit";

type ClusterModalProps = {
  open: boolean;
  mode: ModalMode;
  initial?: ClusterResponse | null;
  onClose: () => void;
  onSave: (data: CreateClusterPayload, id?: number) => Promise<void>;
  submitting: boolean;
  isAdmin: boolean;
};

const emptyForm: CreateClusterPayload = {
  clusterName: "",
  province: "",
  address: "",
  phoneNumber: "",
  latitude: undefined,
  longitude: undefined,
};

function ClusterModal({ open, mode, initial, onClose, onSave, submitting, isAdmin }: ClusterModalProps) {
  const [form, setForm] = useState<CreateClusterPayload>(emptyForm);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setSaveError(null);
      setForm(
        initial
          ? {
              clusterName: initial.clusterName,
              province: initial.province,
              address: initial.address,
              phoneNumber: initial.phoneNumber ?? "",
              latitude: initial.latitude,
              longitude: initial.longitude,
              status: initial.status,
            }
          : emptyForm,
      );
    }
  }, [open, initial]);

  if (!open) return null;

  const inputStyle: React.CSSProperties = {
    fontSize: "14px",
    background: "var(--bg-main)",
    color: "var(--text-main)",
    border: "1px solid var(--border-color)",
  };

  const handleAddressChange = (address: string, lat?: number, lng?: number) => {
    if (lat !== undefined && lng !== undefined) {
      setForm((prev) => ({ ...prev, address, latitude: lat, longitude: lng }));
    } else {
      setForm((prev) => ({ ...prev, address, latitude: undefined, longitude: undefined }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveError(null);
    const normalizedPhone = form.phoneNumber?.replace(/[\s\-().]/g, "") || undefined;
    try {
      await onSave({ ...form, phoneNumber: normalizedPhone }, initial?.clusterId);
    } catch (err: any) {
      setSaveError(err?.response?.data?.message ?? "Save failed. Please try again.");
    }
  };

  const hasCoords = form.latitude != null && form.longitude != null;

  // ADMIN editing an existing ACTIVE/INACTIVE cluster can toggle status
  const showStatusToggle = mode === "edit" && isAdmin
    && (initial?.status === "ACTIVE" || initial?.status === "INACTIVE");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" onClick={onClose} />
      <div
        className="relative w-full max-w-lg mx-4 rounded-2xl shadow-2xl overflow-hidden"
        style={{ background: "var(--bg-main)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b" style={{ borderColor: "var(--border-color)" }}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
              <MapPin size={16} className="text-blue-600" />
            </div>
            <h2 style={{ fontSize: "16px", color: "var(--text-main)", fontWeight: 600 }}>
              {mode === "create" ? "Add Cinema Cluster" : "Edit Cinema Cluster"}
            </h2>
          </div>
          <button
            type="button" onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center transition-colors"
            style={{ color: "var(--text-sub)" }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">

          {/* Draft notice on create */}
          {mode === "create" && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl border" style={{ borderColor: "rgba(107,114,128,0.3)", background: "rgba(107,114,128,0.06)" }}>
              <Clock size={13} style={{ color: "#6b7280", flexShrink: 0 }} />
              <p style={{ fontSize: "12px", color: "#6b7280" }}>
                Cluster sẽ được tạo với trạng thái <strong>Draft</strong>. Sau khi tạo xong, nhấn Submit để gửi admin duyệt.
              </p>
            </div>
          )}

          <div>
            <label className="block mb-1.5" style={{ fontSize: "13px", color: "var(--text-sub)" }}>
              Cluster Name <span className="text-rose-500">*</span>
            </label>
            <input
              required type="text" placeholder="e.g. CinePrime Hà Nội"
              minLength={2} maxLength={100}
              value={form.clusterName}
              onChange={(e) => setForm({ ...form, clusterName: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl border outline-none focus:border-blue-400 transition-colors"
              style={inputStyle}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block mb-1.5" style={{ fontSize: "13px", color: "var(--text-sub)" }}>
                Province / City <span className="text-rose-500">*</span>
              </label>
              <select
                required
                value={form.province}
                onChange={(e) => setForm({ ...form, province: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border outline-none focus:border-blue-400 transition-colors"
                style={inputStyle}
              >
                <option value="">Select province…</option>
                {PROVINCES.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block mb-1.5" style={{ fontSize: "13px", color: "var(--text-sub)" }}>
                Phone Number
              </label>
              <input
                type="tel" placeholder="028 xxxx xxxx"
                value={form.phoneNumber ?? ""}
                onChange={(e) => setForm({ ...form, phoneNumber: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border outline-none focus:border-blue-400 transition-colors"
                style={inputStyle}
              />
            </div>
          </div>

          {/* Address — Nominatim autocomplete */}
          <div>
            <label className="block mb-1.5" style={{ fontSize: "13px", color: "var(--text-sub)" }}>
              Address <span className="text-rose-500">*</span>
              <span style={{ fontSize: "11px", color: "var(--text-sub)", marginLeft: "6px" }}>· autocomplete enabled</span>
            </label>
            <PlacesAddressInput
              required
              value={form.address}
              onChange={handleAddressChange}
              onProvinceDetected={(province) => setForm((prev) => ({ ...prev, province }))}
              className="w-full px-3.5 py-2.5 rounded-xl border outline-none focus:border-blue-400 transition-colors"
              style={inputStyle}
            />
            {hasCoords ? (
              <>
                <p className="flex items-center gap-1 mt-1" style={{ fontSize: "11px", color: "#10b981" }}>
                  <MapPin size={10} />
                  {form.latitude!.toFixed(6)}, {form.longitude!.toFixed(6)} — coordinates auto-filled
                </p>
                <div style={{ marginTop: "8px", borderRadius: "10px", overflow: "hidden", border: "1px solid var(--border-color)", position: "relative" }}>
                  <iframe
                    title="Location preview"
                    src={`https://www.openstreetmap.org/export/embed.html?bbox=${form.longitude! - 0.008},${form.latitude! - 0.005},${form.longitude! + 0.008},${form.latitude! + 0.005}&layer=mapnik&marker=${form.latitude},${form.longitude}`}
                    width="100%" height="200"
                    style={{ border: "none", display: "block" }}
                  />
                  <a
                    href={`https://www.openstreetmap.org/?mlat=${form.latitude}&mlon=${form.longitude}#map=16/${form.latitude}/${form.longitude}`}
                    target="_blank" rel="noopener noreferrer"
                    style={{ position: "absolute", bottom: "6px", right: "8px", fontSize: "10px", color: "#3b82f6", background: "var(--bg-main)", padding: "2px 6px", borderRadius: "4px", textDecoration: "none", opacity: 0.9 }}
                  >
                    Open in map ↗
                  </a>
                </div>
              </>
            ) : (
              <p style={{ fontSize: "11px", color: "var(--text-sub)", marginTop: "4px" }}>
                Select from suggestions to auto-fill coordinates.
              </p>
            )}
          </div>

          {/* Status toggle — chỉ ADMIN khi edit ACTIVE/INACTIVE */}
          {showStatusToggle && (
            <div>
              <label className="block mb-2" style={{ fontSize: "13px", color: "var(--text-sub)" }}>Status</label>
              <div className="flex gap-3">
                {(["ACTIVE", "INACTIVE"] as ClusterStatus[]).map((s) => {
                  const active = form.status === s;
                  const color = s === "ACTIVE" ? "#10b981" : "#ef4444";
                  return (
                    <button
                      key={s} type="button"
                      onClick={() => setForm({ ...form, status: s })}
                      style={{
                        flex: 1, padding: "9px 12px", borderRadius: "10px",
                        border: `1.5px solid ${active ? color : "var(--border-color)"}`,
                        background: active ? `${color}14` : "var(--bg-main)",
                        cursor: "pointer", transition: "all 0.15s ease",
                        fontSize: "13px", fontWeight: 600,
                        color: active ? color : "var(--text-sub)",
                      }}
                    >
                      {s === "ACTIVE" ? "Active" : "Inactive"}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Inline error */}
          {saveError && (
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-rose-200 bg-rose-50">
              <AlertCircle size={14} className="text-rose-500 flex-shrink-0" />
              <p style={{ fontSize: "13px", color: "#e11d48" }}>{saveError}</p>
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="button" onClick={onClose} disabled={submitting}
              className="flex-1 px-4 py-2.5 rounded-xl border transition-colors hover:opacity-80 disabled:opacity-50"
              style={{ fontSize: "14px", borderColor: "var(--border-color)", color: "var(--text-main)" }}
            >
              Cancel
            </button>
            <button
              type="submit" disabled={submitting}
              className="flex-1 px-4 py-2.5 rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-60"
              style={{ fontSize: "14px", fontWeight: 500 }}
            >
              {submitting ? "Saving…" : mode === "create" ? "Create Cluster" : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Delete Confirm Modal ──────────────────────────────────────────────────────

function DeleteModal({
  cluster, onConfirm, onCancel, submitting,
}: {
  cluster: ClusterResponse;
  onConfirm: () => void;
  onCancel: () => void;
  submitting: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" onClick={onCancel} />
      <div
        className="relative w-full max-w-sm mx-4 rounded-2xl shadow-2xl p-6"
        style={{ background: "var(--bg-main)" }}
      >
        <div className="w-12 h-12 bg-rose-50 rounded-xl flex items-center justify-center mx-auto mb-4">
          <Trash2 size={20} className="text-rose-500" />
        </div>
        <h3 className="text-center font-semibold mb-1" style={{ color: "var(--text-main)", fontSize: "16px" }}>
          Delete Cluster?
        </h3>
        <p className="text-center mb-5" style={{ color: "var(--text-sub)", fontSize: "13px" }}>
          <strong style={{ color: "var(--text-main)" }}>{cluster.clusterName}</strong> and all associated
          rooms will be permanently removed.
        </p>
        <div className="flex gap-3">
          <button
            onClick={onCancel} disabled={submitting}
            className="flex-1 px-4 py-2.5 rounded-xl border transition-colors hover:opacity-80 disabled:opacity-50"
            style={{ fontSize: "14px", borderColor: "var(--border-color)", color: "var(--text-main)" }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm} disabled={submitting}
            className="flex-1 px-4 py-2.5 rounded-xl bg-rose-500 text-white hover:bg-rose-600 transition-colors disabled:opacity-60"
            style={{ fontSize: "14px", fontWeight: 500 }}
          >
            {submitting ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ManageCinemaClusterPage() {
  const { isDarkMode } = useOutletContext<{ isDarkMode: boolean }>();
  const { can, isAdmin } = useRole();

  const [clusters, setClusters] = useState<ClusterResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<"ALL" | ClusterStatus>("ALL");

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>("create");
  const [editTarget, setEditTarget] = useState<ClusterResponse | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<ClusterResponse | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [rejectTarget, setRejectTarget] = useState<ClusterResponse | null>(null);

  // ── Load ──────────────────────────────────────────────────────────────────

  const loadClusters = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await movieApi.getClusters();
      setClusters(res.result ?? []);
    } catch (err: any) {
      if (err?.response?.status === 404 || err?.code === "ERR_NETWORK") {
        setClusters(MOCK_CLUSTERS);
      } else {
        setError(err?.response?.data?.message ?? "Failed to load cinema clusters.");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadClusters(); }, [loadClusters]);

  // ── CRUD handlers ─────────────────────────────────────────────────────────

  const handleSave = async (data: CreateClusterPayload, id?: number) => {
    setSubmitting(true);
    try {
      if (id !== undefined) {
        const res = await movieApi.updateCluster(id, data);
        setClusters((prev) => prev.map((c) => (c.clusterId === id ? res.result : c)));
      } else {
        const res = await movieApi.createCluster(data);
        setClusters((prev) => [...prev, res.result]);
      }
      setModalOpen(false);
    } catch (err) {
      throw err;
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await movieApi.deleteCluster(deleteTarget.clusterId);
      setClusters((prev) => prev.filter((c) => c.clusterId !== deleteTarget.clusterId));
      setDeleteTarget(null);
    } catch (err: any) {
      alert(`Error: ${err?.response?.data?.message ?? "Delete failed."}`);
    } finally {
      setDeleting(false);
    }
  };

  // ── Workflow handlers ─────────────────────────────────────────────────────

  const doWorkflow = async (fn: () => Promise<{ result: ClusterResponse }>, id: number) => {
    try {
      const res = await fn();
      setClusters((prev) => prev.map((c) => (c.clusterId === id ? res.result : c)));
    } catch (err: any) {
      alert(`Error: ${err?.response?.data?.message ?? "Action failed."}`);
    }
  };

  const handleSubmitCluster = (id: number) =>
    doWorkflow(() => movieApi.submitCluster(id), id);

  const handleApproveCluster = (id: number) =>
    doWorkflow(() => movieApi.approveCluster(id), id);

  const handleRejectCluster = (id: number, note: string) =>
    doWorkflow(() => movieApi.rejectCluster(id, note), id);

  // ── Modal helpers ─────────────────────────────────────────────────────────

  const openCreate = () => {
    setEditTarget(null);
    setModalMode("create");
    setModalOpen(true);
  };

  const openEdit = (cluster: ClusterResponse) => {
    setEditTarget(cluster);
    setModalMode("edit");
    setModalOpen(true);
  };

  // ── Filtering & stats ─────────────────────────────────────────────────────

  const filtered = clusters.filter((c) => {
    const matchSearch =
      !searchQuery ||
      c.clusterName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.province.toLowerCase().includes(searchQuery.toLowerCase());
    const matchStatus = filterStatus === "ALL" || c.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const activeCount  = clusters.filter((c) => c.status === "ACTIVE").length;
  const pendingCount = clusters.filter((c) => c.status === "PENDING_REVIEW").length;
  const totalRooms   = clusters.reduce((s, c) => s + (c.totalRooms ?? 0), 0);
  const totalSeats   = clusters.reduce((s, c) => s + (c.totalSeats ?? 0), 0);

  const inputStyle: React.CSSProperties = {
    fontSize: "14px",
    background: "var(--bg-card)",
    color: "var(--text-main)",
    border: "1px solid var(--border-color)",
  };

  return (
    <>
      {/* Header */}
      <div style={{ marginBottom: "28px" }}>
        <h1 style={{ color: "var(--text-main)", fontWeight: 600, fontSize: "22px", letterSpacing: "-0.01em", marginBottom: "5px" }}>
          Cinema Clusters
        </h1>
        <p style={{ color: "var(--text-sub)", fontSize: "13px" }}>
          Manage cinema locations and clusters across the country
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: "Total Clusters",  value: loading ? "—" : String(clusters.length),     icon: MapPin,      color: "blue"    },
          { label: "Active",          value: loading ? "—" : String(activeCount),          icon: CheckCircle, color: "emerald" },
          { label: "Pending Review",  value: loading ? "—" : String(pendingCount),         icon: Clock,       color: "amber"   },
          { label: "Total Rooms",     value: loading ? "—" : String(totalRooms),           icon: Building2,   color: "violet"  },
        ].map(({ label, value, icon: Icon, color }) => {
          const bg = { blue: "bg-blue-50", emerald: "bg-emerald-50", amber: "bg-amber-50", violet: "bg-violet-50" }[color]!;
          const ic = { blue: "text-blue-600", emerald: "text-emerald-600", amber: "text-amber-600", violet: "text-violet-600" }[color]!;
          return (
            <div key={label} className="rounded-2xl border p-5 flex items-center gap-4" style={{ background: "var(--bg-card)", borderColor: "var(--border-color)" }}>
              <div className={`w-11 h-11 rounded-xl ${bg} flex items-center justify-center flex-shrink-0`}>
                <Icon size={18} className={ic} />
              </div>
              <div>
                <p style={{ fontSize: "12px", color: "var(--text-sub)" }}>{label}</p>
                <p style={{ fontSize: "22px", fontWeight: 700, color: "var(--text-main)", lineHeight: 1.2 }}>{value}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl mb-5 border border-rose-200 bg-rose-50">
          <AlertCircle size={16} className="text-rose-500 flex-shrink-0" />
          <p style={{ fontSize: "14px", color: "#e11d48" }}>{error}</p>
          <button onClick={loadClusters} className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-100 hover:bg-rose-200 transition-colors text-rose-600" style={{ fontSize: "13px" }}>
            <RefreshCw size={13} /> Retry
          </button>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap mb-6">
        <div className="relative flex-1 min-w-48">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "var(--text-sub)" }} />
          <input
            type="text" placeholder="Search cluster name or province…"
            value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl outline-none transition-all"
            style={inputStyle}
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-sub)" }}>×</button>
          )}
        </div>

        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as any)}
          className="px-3.5 py-2.5 rounded-xl border outline-none transition-all"
          style={{ ...inputStyle, minWidth: "150px" }}
        >
          <option value="ALL">All Status</option>
          <option value="DRAFT">Draft</option>
          <option value="PENDING_REVIEW">Pending Review</option>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
        </select>

        <button
          onClick={loadClusters} disabled={loading}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all hover:opacity-80 disabled:opacity-50"
          style={{ fontSize: "14px", background: "var(--bg-card)", color: "var(--text-main)", borderColor: "var(--border-color)" }}
        >
          <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
          {loading ? "Loading…" : "Refresh"}
        </button>

        {can.edit && (
          <button
            onClick={openCreate}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white hover:opacity-90 transition-all shadow-sm"
            style={{ fontSize: "14px", fontWeight: 500, background: isDarkMode ? "#3b82f6" : "#2563eb" }}
          >
            <Plus size={16} /> Add Cluster
          </button>
        )}
      </div>

      {/* Table */}
      <div className="rounded-2xl border overflow-hidden" style={{ background: "var(--bg-card)", borderColor: "var(--border-color)" }}>
        <table className="w-full">
          <thead>
            <tr className="border-b" style={{ borderColor: "var(--border-color)", backgroundColor: "rgba(128,128,128,0.04)" }}>
              {["#", "Cluster", "Province", "Address", "Rooms", "Seats", "Status", ""].map((h) => (
                <th key={h} className="px-5 py-3.5 text-left">
                  <span style={{ color: "var(--text-sub)", fontSize: "11px", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" }}>{h}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && clusters.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-5 py-16 text-center">
                  <RefreshCw size={18} className="animate-spin mx-auto mb-2" style={{ color: "var(--text-sub)" }} />
                  <p style={{ fontSize: "14px", color: "var(--text-sub)" }}>Loading clusters…</p>
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-5 py-16 text-center" style={{ fontSize: "14px", color: "var(--text-sub)" }}>
                  {searchQuery || filterStatus !== "ALL"
                    ? "No clusters match your filters."
                    : "No cinema clusters yet. Add one to get started."}
                </td>
              </tr>
            ) : (
              filtered.map((cluster, idx) => {
                const cfg = STATUS_CONFIG[cluster.status];
                const StatusIcon = cfg.icon;
                return (
                  <tr
                    key={cluster.clusterId}
                    className="cluster-row border-b transition-colors"
                    style={{ borderColor: "var(--border-color)" }}
                  >
                    <td className="px-5 py-4">
                      <span style={{ fontSize: "13px", color: "var(--text-sub)" }}>{idx + 1}</span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                          <MapPin size={16} className="text-blue-600" />
                        </div>
                        <div>
                          <p style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-main)" }}>{cluster.clusterName}</p>
                          {cluster.phoneNumber && (
                            <p className="flex items-center gap-1" style={{ fontSize: "11px", color: "var(--text-sub)" }}>
                              <Phone size={10} />{cluster.phoneNumber}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
                        style={{ background: "rgba(59,130,246,0.08)", color: "#3b82f6" }}
                      >
                        <MapPin size={10} />{cluster.province}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div>
                        <span style={{ fontSize: "13px", color: "var(--text-sub)", maxWidth: "200px", display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {cluster.address}
                        </span>
                        {cluster.latitude != null && cluster.longitude != null && (
                          <span className="inline-flex items-center gap-1 mt-0.5" style={{ fontSize: "10px", color: "#10b981" }}>
                            <MapPin size={8} />
                            {cluster.latitude.toFixed(4)}, {cluster.longitude.toFixed(4)}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-violet-50 text-violet-700">
                        <Building2 size={10} />{cluster.totalRooms ?? 0}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700">
                        <Armchair size={10} />{(cluster.totalSeats ?? 0).toLocaleString()}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      {/* Status badge */}
                      <span
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap"
                        style={{ background: cfg.bg, color: cfg.color }}
                      >
                        <StatusIcon size={11} />
                        {cfg.label}
                      </span>
                      {/* Rejection note */}
                      {cluster.rejectionNote && (
                        <div className="flex items-start gap-1 mt-1.5 max-w-[160px]">
                          <AlertCircle size={10} style={{ color: "#d97706", flexShrink: 0, marginTop: "1px" }} />
                          <span style={{ fontSize: "10.5px", color: "#d97706", lineHeight: 1.3 }}>
                            {cluster.rejectionNote}
                          </span>
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <ClusterActions
                        cluster={cluster}
                        onEdit={() => openEdit(cluster)}
                        onDelete={() => setDeleteTarget(cluster)}
                        onSubmit={() => handleSubmitCluster(cluster.clusterId)}
                        onApprove={() => handleApproveCluster(cluster.clusterId)}
                        onRejectClick={() => setRejectTarget(cluster)}
                      />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        {filtered.length > 0 && (
          <div className="px-5 py-3.5 border-t" style={{ borderColor: "var(--border-color)" }}>
            <p style={{ fontSize: "13px", color: "var(--text-sub)" }}>
              <span style={{ color: "var(--text-main)", fontWeight: 500 }}>{filtered.length}</span> cluster{filtered.length !== 1 ? "s" : ""}
              {filterStatus !== "ALL" && ` · filtered by ${STATUS_CONFIG[filterStatus as ClusterStatus]?.label ?? filterStatus}`}
            </p>
          </div>
        )}
      </div>

      {/* Modals */}
      <ClusterModal
        open={modalOpen}
        mode={modalMode}
        initial={editTarget}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
        submitting={submitting}
        isAdmin={isAdmin}
      />

      {deleteTarget && (
        <DeleteModal
          cluster={deleteTarget}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
          submitting={deleting}
        />
      )}

      {rejectTarget && (
        <InputModal
          title="Reject Cluster"
          label="Rejection reason"
          placeholder="Mô tả vấn đề cụ thể: địa chỉ không đúng, tên trùng, tọa độ sai…"
          confirmLabel="Reject"
          confirmColor="#dc2626"
          icon={XCircle}
          onConfirm={(note) => {
            handleRejectCluster(rejectTarget.clusterId, note);
            setRejectTarget(null);
          }}
          onCancel={() => setRejectTarget(null)}
        />
      )}

      <style>{`
        .cluster-row:hover { background-color: rgba(128,128,128,0.04); }
        .theme-dark .cluster-row:hover { background-color: rgba(255,255,255,0.03); }
        .cluster-row:hover .cluster-actions { opacity: 1; }
        .cluster-action-btn:hover { background-color: rgba(128,128,128,0.1); }
      `}</style>
    </>
  );
}

// ── Mock data ─────────────────────────────────────────────────────────────────

const MOCK_CLUSTERS: ClusterResponse[] = [
  { clusterId: 1, clusterName: "CinePrime Quận 1",    province: "TP. Hồ Chí Minh", address: "123 Nguyễn Huệ, Quận 1",        phoneNumber: "028 3822 1234", latitude: 10.776966, longitude: 106.700965, status: "ACTIVE",         totalRooms: 5, totalSeats: 650 },
  { clusterId: 2, clusterName: "CinePrime Thủ Đức",   province: "TP. Hồ Chí Minh", address: "456 Võ Văn Ngân, TP. Thủ Đức", phoneNumber: "028 3896 5678", latitude: 10.850000, longitude: 106.771667, status: "ACTIVE",         totalRooms: 4, totalSeats: 480 },
  { clusterId: 3, clusterName: "CinePrime Hoàn Kiếm", province: "Hà Nội",           address: "78 Hàng Bài, Hoàn Kiếm",       phoneNumber: "024 3936 9012", latitude: 21.028511, longitude: 105.834160, status: "PENDING_REVIEW", totalRooms: 0, totalSeats: 0   },
  { clusterId: 4, clusterName: "CinePrime Cầu Giấy",  province: "Hà Nội",           address: "22 Xuân Thủy, Cầu Giấy",       phoneNumber: "024 3768 3456", latitude: 21.036389, longitude: 105.782222, status: "DRAFT",         totalRooms: 0, totalSeats: 0,  rejectionNote: "Địa chỉ chưa đầy đủ, vui lòng bổ sung số nhà." },
  { clusterId: 5, clusterName: "CinePrime Hải Châu",  province: "Đà Nẵng",          address: "30 Trần Phú, Hải Châu",        phoneNumber: "0236 382 7890", latitude: 16.068000, longitude: 108.212000, status: "ACTIVE",         totalRooms: 3, totalSeats: 360 },
  { clusterId: 6, clusterName: "CinePrime Ninh Kiều", province: "Cần Thơ",          address: "15 Hai Bà Trưng, Ninh Kiều",   phoneNumber: "0292 381 2345", latitude: 10.033333, longitude: 105.783333, status: "INACTIVE",       totalRooms: 2, totalSeats: 220 },
];
