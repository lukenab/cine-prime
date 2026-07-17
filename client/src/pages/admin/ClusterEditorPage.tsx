import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft, Building2, ChevronRight, MapPin, Mail, Phone, Timer, Globe2, Clock, AlertCircle,
  CalendarDays, Settings2, Check,
} from "lucide-react";
import {
  movieApi,
  type ClusterResponse,
  type CreateClusterPayload,
  type ClusterOperatingDay,
  type ClusterOperatingHour,
  type ClusterVenueType,
  type ClusterStatus,
} from "../../api/movieApi";
import { useRole } from "../../hooks/useRole";
import { LoadingState } from "../../components/shared/LoadingState";
import { ErrorBanner } from "../../components/shared/ErrorBanner";

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
    city_district?: string;
    district?: string;
    suburb?: string;
    quarter?: string;
    neighbourhood?: string;
    postcode?: string;
    amenity?: string;
    shop?: string;
    building?: string;
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
  onLocationDetected?: (location: { district?: string; ward?: string; postalCode?: string; buildingName?: string }) => void;
  style?: React.CSSProperties;
  className?: string;
  required?: boolean;
};

function PlacesAddressInput({ value, onChange, onProvinceDetected, onLocationDetected, style, className, required }: PlacesInputProps) {
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
    onLocationDetected?.({
      district: s.address?.city_district ?? s.address?.district ?? s.address?.county,
      ward: s.address?.suburb ?? s.address?.quarter ?? s.address?.neighbourhood,
      postalCode: s.address?.postcode,
      buildingName: s.address?.amenity ?? s.address?.shop ?? s.address?.building,
    });
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

// ── Form scaffolding ──────────────────────────────────────────────────────────

const OPERATING_DAYS: Array<{ id: ClusterOperatingDay; label: string }> = [
  { id: "MONDAY", label: "Mon" }, { id: "TUESDAY", label: "Tue" },
  { id: "WEDNESDAY", label: "Wed" }, { id: "THURSDAY", label: "Thu" },
  { id: "FRIDAY", label: "Fri" }, { id: "SATURDAY", label: "Sat" },
  { id: "SUNDAY", label: "Sun" },
];

const VENUE_TYPES: Array<{ id: ClusterVenueType; label: string }> = [
  { id: "MALL", label: "Shopping mall" },
  { id: "STANDALONE", label: "Standalone" },
  { id: "MIXED_USE", label: "Mixed-use complex" },
];

const createDefaultHours = (): ClusterOperatingHour[] => OPERATING_DAYS.map(({ id }) => ({
  dayOfWeek: id, opensAt: "08:00", closesAt: "23:00", closesNextDay: false, closed: false,
}));

/** True neu ca 7 ngay dang co cung closed/opensAt/closesAt/closesNextDay - dung de quyet dinh
 *  mac dinh bat/tat toggle "Use the same hours every day" (vd khi hydrate 1 cluster co san). */
const isUniformSchedule = (hours: ClusterOperatingHour[]): boolean => {
  if (hours.length !== 7) return false;
  const [first, ...rest] = hours;
  return rest.every((hour) =>
    hour.closed === first.closed
    && hour.opensAt === first.opensAt
    && hour.closesAt === first.closesAt
    && hour.closesNextDay === first.closesNextDay
  );
};

const formatHourRange = (hour: ClusterOperatingHour): string => {
  if (hour.closed) return "Closed";
  if (!hour.opensAt || !hour.closesAt) return "—";
  return `${hour.opensAt}\u2013${hour.closesAt}${hour.closesNextDay ? " (overnight)" : ""}`;
};

/**
 * Gom cac ngay lien tiep co cung gio hoat dong thanh 1 dong tom tat, vi du
 * "Mon–Fri 08:00–23:00 · Sat–Sun 08:00–00:00 (overnight)" - giup admin kiem tra
 * nhanh lich tuan ma khong phai doc tung dong trong bang 7 ngay.
 */
const summarizeWeek = (hours: ClusterOperatingHour[]): string => {
  const ordered = OPERATING_DAYS
    .map(({ id, label }) => ({ label, hour: hours.find((hour) => hour.dayOfWeek === id) }))
    .filter((entry): entry is { label: string; hour: ClusterOperatingHour } => !!entry.hour);

  const groups: Array<{ labels: string[]; hour: ClusterOperatingHour }> = [];
  for (const entry of ordered) {
    const last = groups[groups.length - 1];
    if (
      last
      && last.hour.closed === entry.hour.closed
      && last.hour.opensAt === entry.hour.opensAt
      && last.hour.closesAt === entry.hour.closesAt
      && last.hour.closesNextDay === entry.hour.closesNextDay
    ) {
      last.labels.push(entry.label);
    } else {
      groups.push({ labels: [entry.label], hour: entry.hour });
    }
  }

  return groups
    .map(({ labels, hour }) => {
      const range = labels.length > 1 ? `${labels[0]}\u2013${labels[labels.length - 1]}` : labels[0];
      return `${range} ${formatHourRange(hour)}`;
    })
    .join(" \u00b7 ");
};

const createEmptyForm = (clusterCode: string): CreateClusterPayload => ({
  clusterCode,
  clusterName: "",
  venueType: "MALL",
  openingDate: "",
  publicEmail: "",
  countryCode: "VN",
  province: "",
  district: "",
  ward: "",
  postalCode: "",
  buildingName: "",
  floorLocation: "",
  address: "",
  latitude: undefined,
  longitude: undefined,
  timezone: "Asia/Ho_Chi_Minh",
  operatingHours: createDefaultHours(),
});

function toFormState(cluster: ClusterResponse): CreateClusterPayload {
  return {
    clusterCode: cluster.clusterCode ?? "",
    clusterName: cluster.clusterName,
    venueType: cluster.venueType ?? "MALL",
    openingDate: cluster.openingDate ?? "",
    publicEmail: cluster.publicEmail ?? "",
    countryCode: cluster.countryCode ?? "VN",
    province: cluster.province,
    district: cluster.district ?? "",
    ward: cluster.ward ?? "",
    postalCode: cluster.postalCode ?? "",
    buildingName: cluster.buildingName ?? "",
    floorLocation: cluster.floorLocation ?? "",
    address: cluster.address,
    latitude: cluster.latitude,
    longitude: cluster.longitude,
    timezone: cluster.timezone ?? "Asia/Ho_Chi_Minh",
    operatingHours: cluster.operatingHours?.length === 7 ? cluster.operatingHours : createDefaultHours(),
    status: cluster.status,
  };
}

function FormSection({ icon: Icon, title, description, children }: { icon: React.ElementType; title: string; description: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border p-4" style={{ borderColor: "var(--border-color)", background: "var(--bg-card)" }}>
      <div className="mb-3 flex items-start gap-2.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600"><Icon size={15} /></span>
        <div>
          <h3 style={{ fontSize: "13px", fontWeight: 700, color: "var(--text-main)" }}>{title}</h3>
          <p style={{ fontSize: "10.5px", color: "var(--text-sub)", lineHeight: 1.35 }}>{description}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="mb-1.5 block" style={{ fontSize: "11.5px", fontWeight: 500, color: "var(--text-sub)" }}>
      {children}{required && <span className="text-rose-500"> *</span>}
    </label>
  );
}

// ── Header ─────────────────────────────────────────────────────────────────────

function ClusterEditorHeader({ mode, clusterName, onBack }: { mode: "create" | "edit"; clusterName?: string; onBack: () => void }) {
  return (
    <div className="mb-6">
      <div className="flex items-center gap-1.5 mb-3" style={{ fontSize: "12px", color: "var(--text-sub)" }}>
        <span>Cinemas</span>
        <ChevronRight size={12} />
        <span style={{ color: "var(--text-main)", fontWeight: 600 }}>{mode === "create" ? "Add Cinema Cluster" : "Edit Cinema Cluster"}</span>
      </div>
      <div className="flex items-center gap-4 flex-wrap">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-3 py-2 rounded-xl border transition-all hover:opacity-80 flex-shrink-0"
          style={{ fontSize: "13px", color: "var(--text-sub)", borderColor: "var(--border-color)", background: "var(--bg-card)" }}
        >
          <ArrowLeft size={15} /> Back
        </button>
        <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
          <MapPin size={18} className="text-blue-600" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 style={{ color: "var(--text-main)", fontWeight: 700, fontSize: "20px", lineHeight: 1.2 }}>
            {mode === "create" ? "Add Cinema Cluster" : (clusterName || "Edit Cinema Cluster")}
          </h1>
        </div>
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function ClusterEditorPage() {
  const { id: idParam } = useParams<{ id?: string }>();
  const clusterId = idParam ? Number(idParam) : null;
  const mode: "create" | "edit" = clusterId ? "edit" : "create";
  const navigate = useNavigate();
  const { isAdmin } = useRole();

  const [initial, setInitial] = useState<ClusterResponse | null>(null);
  // Empty starting code (not a placeholder like "CP-001") so the create-mode
  // effect below can tell "nothing suggested yet" apart from "operator already
  // typed a code" and knows it's still safe to fill in the real suggestion.
  const [form, setForm] = useState<CreateClusterPayload>(() => createEmptyForm(""));
  const [hydrating, setHydrating] = useState(!!clusterId);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  // Issue: trang tao cluster - "Use the same hours every day" mac dinh bat (cluster moi
  // luon co lich mac dinh giong nhau ca tuan). Khi edit 1 cluster co san, gia tri nay duoc
  // tu dong xac dinh lai sau khi hydrate xong (xem loadCluster), dua tren du lieu that.
  const [uniformHours, setUniformHours] = useState(true);

  const backTo = () => navigate(clusterId ? `/admin/clusters/${clusterId}` : "/admin/clusters");

  // Edit mode hydrates the real cluster; create mode only needs a starting
  // code suggestion — a guard keeps it from clobbering anything the operator
  // has already typed by the time the (async) suggestion resolves.
  const loadCluster = useCallback(async () => {
    if (clusterId) {
      setHydrating(true);
      setLoadError(null);
      try {
        const res = await movieApi.getClusterById(clusterId);
        setInitial(res.result);
        setForm(toFormState(res.result));
        setUniformHours(isUniformSchedule(res.result.operatingHours ?? []));
      } catch (err: any) {
        setLoadError(err?.response?.data?.message ?? "Failed to load this cinema cluster.");
      } finally {
        setHydrating(false);
      }
    } else {
      try {
        const res = await movieApi.getClusters();
        const nextCode = `CP-${String(Math.max(0, ...(res.result ?? []).map((c) => c.clusterId)) + 1).padStart(3, "0")}`;
        setForm((current) => (current.clusterCode ? current : createEmptyForm(nextCode)));
      } catch {
        // Non-fatal — the CP-001 placeholder stays; the operator can edit the code manually before saving.
      }
    }
  }, [clusterId]);

  useEffect(() => { loadCluster(); }, [loadCluster]);

  const inputStyle: React.CSSProperties = {
    fontSize: "12.5px",
    fontWeight: 500,
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
    setSubmitting(true);
    const payload = {
      ...form,
      clusterCode: form.clusterCode.trim().toUpperCase(),
      openingDate: form.openingDate || undefined,
      publicEmail: form.publicEmail?.trim() || undefined,
      // Status is a dedicated ADMIN activation toggle. DRAFT/PENDING_REVIEW
      // edits must not send status back through the general update contract.
      status: mode === "edit" && isAdmin
        && (initial?.status === "ACTIVE" || initial?.status === "INACTIVE")
        ? form.status
        : undefined,
    };
    try {
      if (mode === "edit" && clusterId) {
        const res = await movieApi.updateCluster(clusterId, payload);
        navigate(`/admin/clusters/${res.result.clusterId}`);
      } else {
        const res = await movieApi.createCluster(payload);
        navigate(`/admin/clusters/${res.result.clusterId}`);
      }
    } catch (err: any) {
      setSaveError(err?.response?.data?.message ?? "Save failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const hasCoords = form.latitude != null && form.longitude != null;
  const updateOperatingHour = (day: ClusterOperatingDay, patch: Partial<ClusterOperatingHour>) => {
    setForm((current) => ({
      ...current,
      operatingHours: current.operatingHours.map((hour) => hour.dayOfWeek === day ? { ...hour, ...patch } : hour),
    }));
  };
  const copyMondayToAll = () => {
    const monday = form.operatingHours.find((hour) => hour.dayOfWeek === "MONDAY");
    if (!monday) return;
    setForm((current) => ({
      ...current,
      operatingHours: current.operatingHours.map((hour) => ({ ...monday, dayOfWeek: hour.dayOfWeek })),
    }));
  };
  // Bat "Use the same hours every day": dong bo ngay theo Monday de tranh giu lai am tham
  // 7 gia tri khac nhau phia sau hau truong (chi la khong hien thi ra UI nua). Tat toggle
  // thi khong can lam gi them - bang 7 dong hien lai dung nguyen gia tri hien co.
  const handleUniformToggle = (checked: boolean) => {
    setUniformHours(checked);
    if (checked) copyMondayToAll();
  };
  const updateAllDays = (patch: Partial<ClusterOperatingHour>) => {
    setForm((current) => ({
      ...current,
      operatingHours: current.operatingHours.map((hour) => ({ ...hour, ...patch })),
    }));
  };
  // 2 preset thuong gap nhat trong thuc te: gio thuong ngay (Mon lam chuan cho Tue-Fri)
  // va gio cuoi tuan thuong dai hon (Sat lam chuan cho Sun) - xem cau tra loi truoc ve
  // pattern cua CGV/Lotte/quoc te. Giam tu 7 thao tac tay xuong con 2 (sua Mon + Sat) + 2 click.
  const copyMondayToWeekdays = () => {
    const monday = form.operatingHours.find((hour) => hour.dayOfWeek === "MONDAY");
    if (!monday) return;
    const weekdays: ClusterOperatingDay[] = ["TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"];
    setForm((current) => ({
      ...current,
      operatingHours: current.operatingHours.map((hour) =>
        weekdays.includes(hour.dayOfWeek) ? { ...monday, dayOfWeek: hour.dayOfWeek } : hour
      ),
    }));
  };
  const copySaturdayToSunday = () => {
    const saturday = form.operatingHours.find((hour) => hour.dayOfWeek === "SATURDAY");
    if (!saturday) return;
    setForm((current) => ({
      ...current,
      operatingHours: current.operatingHours.map((hour) =>
        hour.dayOfWeek === "SUNDAY" ? { ...saturday, dayOfWeek: hour.dayOfWeek } : hour
      ),
    }));
  };

  // ADMIN editing an existing ACTIVE/INACTIVE cluster can toggle status
  const showStatusToggle = mode === "edit" && isAdmin
    && (initial?.status === "ACTIVE" || initial?.status === "INACTIVE");

  if (hydrating) {
    return (
      <>
        <ClusterEditorHeader mode={mode} onBack={backTo} />
        <LoadingState label="Loading cinema cluster…" />
      </>
    );
  }

  if (loadError) {
    return (
      <>
        <ClusterEditorHeader mode={mode} onBack={backTo} />
        <ErrorBanner message={loadError} onRetry={loadCluster} />
      </>
    );
  }

  return (
    <>
      <ClusterEditorHeader mode={mode} clusterName={initial?.clusterName} onBack={backTo} />

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Draft notice on create */}
        {mode === "create" && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl border" style={{ borderColor: "rgba(107,114,128,0.3)", background: "rgba(107,114,128,0.06)" }}>
            <Clock size={13} style={{ color: "#6b7280", flexShrink: 0 }} />
            <p style={{ fontSize: "12px", color: "#6b7280" }}>
              {isAdmin
                ? <>ADMIN tạo cụm rạp ở trạng thái <strong>Active</strong>. Hãy kiểm tra đủ thông tin vận hành trước khi lưu.</>
                : <>Cụm rạp được lưu ở trạng thái <strong>Draft</strong> và cần Submit for Review trước khi hoạt động.</>}
            </p>
          </div>
        )}

        <FormSection icon={Building2} title="1. Cluster identity" description="Stable identifiers used by scheduling, reporting and integrations.">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <div><FieldLabel required>Cluster code</FieldLabel><input required pattern="[A-Z0-9][A-Z0-9-]{1,19}" value={form.clusterCode} disabled={mode === "edit" && initial?.status !== "DRAFT"} onChange={(e) => setForm({ ...form, clusterCode: e.target.value.toUpperCase() })} placeholder="CP-HCM-01" className="h-10 w-full rounded-lg border px-3 outline-none focus:border-blue-400 disabled:opacity-60" style={inputStyle} /></div>
            <div><FieldLabel required>Cluster name</FieldLabel><input required minLength={2} maxLength={100} value={form.clusterName} onChange={(e) => setForm({ ...form, clusterName: e.target.value })} placeholder="CinePrime Landmark 81" className="h-10 w-full rounded-lg border px-3 outline-none focus:border-blue-400" style={inputStyle} /></div>
            <div><FieldLabel>Opening date</FieldLabel><input type="date" value={form.openingDate ?? ""} onChange={(e) => setForm({ ...form, openingDate: e.target.value })} className="h-10 w-full rounded-lg border px-3 outline-none focus:border-blue-400" style={inputStyle} /></div>
            <div>
              <FieldLabel required>Venue type</FieldLabel>
              <select required value={form.venueType} onChange={(e) => setForm({ ...form, venueType: e.target.value as ClusterVenueType })} className="h-10 w-full rounded-lg border px-3 outline-none focus:border-blue-400" style={inputStyle}>{VENUE_TYPES.map((type) => <option key={type.id} value={type.id}>{type.label}</option>)}</select>
            </div>
          </div>
          <p className="mt-2" style={{ fontSize: "10.5px", color: "var(--text-sub)" }}>
            Venue type is classification only — it drives the badge shown on the cluster list and future reporting, it doesn't change scheduling rules.
          </p>
        </FormSection>

        <FormSection icon={MapPin} title="2. Address & geolocation" description="Select an address suggestion to reduce manual province, district and coordinate errors.">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <div className="md:col-span-2"><FieldLabel>Building / venue</FieldLabel><input value={form.buildingName ?? ""} onChange={(e) => setForm({ ...form, buildingName: e.target.value })} placeholder="Landmark 81" className="h-10 w-full rounded-lg border px-3 outline-none focus:border-blue-400" style={inputStyle} /></div>
            <div><FieldLabel>Floor</FieldLabel><input value={form.floorLocation ?? ""} onChange={(e) => setForm({ ...form, floorLocation: e.target.value })} placeholder="B1 / Level 5" className="h-10 w-full rounded-lg border px-3 outline-none focus:border-blue-400" style={inputStyle} /></div>
            <div><FieldLabel>Postal code</FieldLabel><input value={form.postalCode ?? ""} onChange={(e) => setForm({ ...form, postalCode: e.target.value })} placeholder="700000" className="h-10 w-full rounded-lg border px-3 outline-none focus:border-blue-400" style={inputStyle} /></div>
            <div><FieldLabel required>Province / City</FieldLabel><select required value={form.province} onChange={(e) => setForm({ ...form, province: e.target.value })} className="h-10 w-full rounded-lg border px-3 outline-none focus:border-blue-400" style={inputStyle}><option value="">Select province…</option>{PROVINCES.map((province) => <option key={province} value={province}>{province}</option>)}</select></div>
            <div><FieldLabel required>District</FieldLabel><input required value={form.district} onChange={(e) => setForm({ ...form, district: e.target.value })} placeholder="Bình Thạnh" className="h-10 w-full rounded-lg border px-3 outline-none focus:border-blue-400" style={inputStyle} /></div>
            <div><FieldLabel>Ward</FieldLabel><input value={form.ward ?? ""} onChange={(e) => setForm({ ...form, ward: e.target.value })} placeholder="Ward 22" className="h-10 w-full rounded-lg border px-3 outline-none focus:border-blue-400" style={inputStyle} /></div>
            <div><FieldLabel required>Country</FieldLabel><input value="Vietnam (VN)" readOnly className="h-10 w-full rounded-lg border px-3 opacity-70" style={inputStyle} /></div>
            <div className="md:col-span-4"><FieldLabel required>Full address · autocomplete</FieldLabel><PlacesAddressInput required value={form.address} onChange={handleAddressChange} onProvinceDetected={(province) => setForm((current) => ({ ...current, province }))} onLocationDetected={(location) => setForm((current) => ({ ...current, district: location.district ?? current.district, ward: location.ward ?? current.ward, postalCode: location.postalCode ?? current.postalCode }))} className="h-10 w-full rounded-lg border px-3 outline-none focus:border-blue-400" style={inputStyle} /></div>
          </div>
          {hasCoords ? (
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2" style={{ borderColor: "rgba(16,185,129,0.28)", background: "rgba(16,185,129,0.06)" }}>
              <span className="flex items-center gap-1.5" style={{ fontSize: "11px", color: "#059669" }}><MapPin size={11} />{form.latitude!.toFixed(6)}, {form.longitude!.toFixed(6)}</span>
              <a href={`https://www.openstreetmap.org/?mlat=${form.latitude}&mlon=${form.longitude}#map=16/${form.latitude}/${form.longitude}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: "11px", color: "#2563eb" }}>Verify on map ↗</a>
            </div>
          ) : <p className="mt-2" style={{ fontSize: "10.5px", color: "#d97706" }}>Select a suggested address to verify coordinates before approval.</p>}
        </FormSection>

        <FormSection icon={Mail} title="3. Public contact" description="The chain hotline is managed centrally and cannot be overridden per cluster.">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div><FieldLabel>Public email</FieldLabel><input type="email" maxLength={150} value={form.publicEmail ?? ""} onChange={(e) => setForm({ ...form, publicEmail: e.target.value })} placeholder="landmark81@cineprime.vn" className="h-10 w-full rounded-lg border px-3 outline-none focus:border-blue-400" style={inputStyle} /></div>
            <div><FieldLabel>Chain hotline</FieldLabel><div className="flex h-10 items-center gap-2 rounded-lg border px-3 opacity-75" style={inputStyle}><Phone size={13} />19001000 <span className="ml-auto" style={{ fontSize: "10px", color: "var(--text-sub)" }}>Centralized</span></div></div>
          </div>
        </FormSection>

        <FormSection icon={Timer} title="4. Operating schedule" description="Local business hours used by scheduling and customer-facing availability.">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
            <div><FieldLabel required>Timezone</FieldLabel><div className="flex h-10 min-w-[230px] items-center gap-2 rounded-lg border px-3" style={inputStyle}><Globe2 size={13} />Asia/Ho_Chi_Minh</div></div>
            <label className="flex items-center gap-2 cursor-pointer pb-1" style={{ fontSize: "12px", color: "var(--text-sub)" }}>
              <input
                type="checkbox"
                className="h-3.5 w-3.5 cursor-pointer"
                checked={uniformHours}
                onChange={(e) => handleUniformToggle(e.target.checked)}
              />
              Use the same hours every day
            </label>
          </div>

          {/* Tom tat lich tuan - kiem tra nhanh khong can doc tung dong trong bang ben duoi */}
          <p className="mb-3 rounded-lg border px-3 py-2" style={{ fontSize: "11.5px", color: "var(--text-sub)", borderColor: "var(--border-color)", background: "rgba(128,128,128,0.04)" }}>
            <strong style={{ color: "var(--text-main)" }}>Weekly summary: </strong>
            {summarizeWeek(form.operatingHours)}
          </p>

          {uniformHours ? (() => {
            const everyDay = form.operatingHours.find((hour) => hour.dayOfWeek === "MONDAY")!;
            return (
              <div className="overflow-hidden rounded-lg border max-w-xl" style={{ borderColor: "var(--border-color)" }}>
                <div
                  className="grid items-center gap-2 px-3 py-2.5"
                  style={{ gridTemplateColumns: "76px 76px minmax(90px,1fr) 16px minmax(90px,1fr) 96px" }}
                >
                  <strong style={{ fontSize: "11.5px", color: "var(--text-main)" }}>Every day</strong>
                  <label className="flex items-center gap-1.5 cursor-pointer" style={{ fontSize: "10.5px", color: "var(--text-sub)" }}>
                    <input
                      type="checkbox"
                      className="h-3.5 w-3.5 cursor-pointer"
                      checked={everyDay.closed}
                      onChange={(e) => updateAllDays(e.target.checked ? { closed: true, opensAt: undefined, closesAt: undefined, closesNextDay: false } : { closed: false, opensAt: "08:00", closesAt: "23:00" })}
                    />
                    Closed
                  </label>
                  <input aria-label="Every day opens at" type="time" required={!everyDay.closed} disabled={everyDay.closed} value={everyDay.opensAt ?? ""} onChange={(e) => updateAllDays({ opensAt: e.target.value })} className="h-8 rounded-md border px-2 disabled:opacity-40" style={inputStyle} />
                  <span className="text-center" style={{ color: "var(--text-sub)" }}>–</span>
                  <input aria-label="Every day closes at" type="time" required={!everyDay.closed} disabled={everyDay.closed} value={everyDay.closesAt ?? ""} onChange={(e) => updateAllDays({ closesAt: e.target.value })} className="h-8 rounded-md border px-2 disabled:opacity-40" style={inputStyle} />
                  <label className="flex items-center gap-1.5 cursor-pointer" style={{ fontSize: "10px", color: "var(--text-sub)" }} title="Closing time is after midnight, on the next calendar day">
                    <input type="checkbox" className="h-3.5 w-3.5 cursor-pointer" disabled={everyDay.closed} checked={everyDay.closesNextDay} onChange={(e) => updateAllDays({ closesNextDay: e.target.checked })} />
                    Overnight
                  </label>
                </div>
                <p className="px-3 pb-2.5 pt-1" style={{ fontSize: "10.5px", color: "var(--text-sub)" }}>
                  Applies to all 7 days. Uncheck "Use the same hours every day" above to set different hours per day (e.g. a later weekend closing time).
                </p>
              </div>
            );
          })() : (
            <>
              <div className="mb-2 flex flex-wrap gap-2">
                <button type="button" onClick={copyMondayToAll} className="h-9 rounded-lg border px-3 text-xs font-semibold hover:bg-blue-500/5" style={{ borderColor: "var(--border-color)", color: "#2563eb" }}>Apply Monday to all days</button>
                <button type="button" onClick={copyMondayToWeekdays} className="h-9 rounded-lg border px-3 text-xs font-semibold hover:bg-blue-500/5" style={{ borderColor: "var(--border-color)", color: "#2563eb" }}>Copy Monday to Tue–Fri</button>
                <button type="button" onClick={copySaturdayToSunday} className="h-9 rounded-lg border px-3 text-xs font-semibold hover:bg-blue-500/5" style={{ borderColor: "var(--border-color)", color: "#2563eb" }}>Copy Saturday to Sunday</button>
              </div>
              <div className="overflow-hidden rounded-lg border max-w-2xl" style={{ borderColor: "var(--border-color)" }}>
                <div
                  className="grid items-center gap-2 px-3 py-2"
                  style={{ gridTemplateColumns: "48px 76px minmax(90px,1fr) 16px minmax(90px,1fr) 96px", background: "rgba(128,128,128,0.05)" }}
                >
                  <span style={{ fontSize: "9.5px", fontWeight: 700, color: "var(--text-sub)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Day</span>
                  <span style={{ fontSize: "9.5px", fontWeight: 700, color: "var(--text-sub)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Closed</span>
                  <span style={{ fontSize: "9.5px", fontWeight: 700, color: "var(--text-sub)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Opens</span>
                  <span />
                  <span style={{ fontSize: "9.5px", fontWeight: 700, color: "var(--text-sub)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Closes</span>
                  <span style={{ fontSize: "9.5px", fontWeight: 700, color: "var(--text-sub)", textTransform: "uppercase", letterSpacing: "0.05em" }} title="Enable when this day's closing time falls after midnight, e.g. opens 10:00, closes 01:00">Overnight</span>
                </div>
                {OPERATING_DAYS.map(({ id, label }, index) => {
                  const hours = form.operatingHours.find((hour) => hour.dayOfWeek === id)!;
                  return (
                    <div
                      key={id}
                      className="grid items-center gap-2 px-3 py-2.5"
                      style={{
                        gridTemplateColumns: "48px 76px minmax(90px,1fr) 16px minmax(90px,1fr) 96px",
                        borderTop: "1px solid var(--border-color)",
                        opacity: hours.closed ? 0.55 : 1,
                        transition: "opacity 0.15s ease",
                      }}
                    >
                      <strong style={{ fontSize: "11.5px", color: "var(--text-main)" }}>{label}</strong>
                      <label className="flex items-center gap-1.5 cursor-pointer" style={{ fontSize: "10.5px", color: "var(--text-sub)" }}>
                        <input
                          type="checkbox"
                          className="h-3.5 w-3.5 cursor-pointer"
                          checked={hours.closed}
                          onChange={(e) => updateOperatingHour(id, e.target.checked ? { closed: true, opensAt: undefined, closesAt: undefined, closesNextDay: false } : { closed: false, opensAt: "08:00", closesAt: "23:00" })}
                        />
                        Closed
                      </label>
                      <input aria-label={`${label} opens at`} type="time" required={!hours.closed} disabled={hours.closed} value={hours.opensAt ?? ""} onChange={(e) => updateOperatingHour(id, { opensAt: e.target.value })} className="h-8 rounded-md border px-2 disabled:opacity-40" style={inputStyle} />
                      <span className="text-center" style={{ color: "var(--text-sub)" }}>–</span>
                      <input aria-label={`${label} closes at`} type="time" required={!hours.closed} disabled={hours.closed} value={hours.closesAt ?? ""} onChange={(e) => updateOperatingHour(id, { closesAt: e.target.value })} className="h-8 rounded-md border px-2 disabled:opacity-40" style={inputStyle} />
                      <label className="flex items-center gap-1.5 cursor-pointer" style={{ fontSize: "10px", color: "var(--text-sub)" }} title="Closing time is after midnight, on the next calendar day">
                        <input type="checkbox" className="h-3.5 w-3.5 cursor-pointer" disabled={hours.closed} checked={hours.closesNextDay} onChange={(e) => updateOperatingHour(id, { closesNextDay: e.target.checked })} />
                        Overnight
                      </label>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </FormSection>

        {/* Status toggle — chỉ ADMIN khi edit ACTIVE/INACTIVE */}
        {showStatusToggle && (
          <div className="rounded-xl border p-4" style={{ borderColor: "var(--border-color)", background: "var(--bg-card)" }}>
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

        <div className="sticky bottom-0 flex justify-end gap-3 border-t px-1 py-4" style={{ borderColor: "var(--border-color)", background: "var(--bg-main)" }}>
          <button
            type="button" onClick={backTo} disabled={submitting}
            className="px-5 py-2.5 rounded-xl border transition-colors hover:opacity-80 disabled:opacity-50"
            style={{ fontSize: "14px", borderColor: "var(--border-color)", color: "var(--text-main)" }}
          >
            Cancel
          </button>
          <button
            type="submit" disabled={submitting}
            className="px-5 py-2.5 rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-60"
            style={{ fontSize: "14px", fontWeight: 600 }}
          >
            {submitting ? "Saving…" : mode === "create" ? "Create Cluster" : "Save Changes"}
          </button>
        </div>
      </form>
    </>
  );
}
