import { useCallback, useEffect, useRef, useState } from "react";
import {
  X, Building2, MapPin, Mail, Phone, Timer, Globe2, Clock, AlertCircle, Check,
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

/**
 * Current provincial-level units per Resolution 60-NQ/TW (effective 12/06/2025), which
 * cut Vietnam from 63 down to 34 units. Entries below are only ones this list previously
 * listed as if they were still standalone provinces/cities but have since been absorbed:
 * Biên Hòa/Nha Trang/Quy Nhơn (now cities *within* a merged province, not one themselves),
 * Bình Dương + Bà Rịa - Vũng Tàu (fully absorbed into TP. Hồ Chí Minh), Long An (merged
 * into Tây Ninh), Bình Định (merged into Gia Lai). Huế is unchanged — it was never merged.
 */
const PROVINCES = [
  "Hà Nội", "TP. Hồ Chí Minh", "Đà Nẵng", "Cần Thơ", "Hải Phòng",
  "Huế", "Khánh Hòa", "Đồng Nai", "Gia Lai", "Tây Ninh",
  "Thanh Hóa", "Nghệ An", "Lâm Đồng",
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
  "Quảng Nam": "Đà Nẵng", // merged into Đà Nẵng, 2025
  "Tỉnh Quảng Nam": "Đà Nẵng",
  "Cần Thơ": "Cần Thơ",
  "Thành phố Cần Thơ": "Cần Thơ",
  "Sóc Trăng": "Cần Thơ", // merged into Cần Thơ, 2025
  "Tỉnh Sóc Trăng": "Cần Thơ",
  "Hậu Giang": "Cần Thơ", // merged into Cần Thơ, 2025
  "Tỉnh Hậu Giang": "Cần Thơ",
  "Hải Phòng": "Hải Phòng",
  "Thành phố Hải Phòng": "Hải Phòng",
  "Hải Dương": "Hải Phòng", // merged into Hải Phòng, 2025
  "Tỉnh Hải Dương": "Hải Phòng",
  "Đồng Nai": "Đồng Nai",
  "Tỉnh Đồng Nai": "Đồng Nai",
  "Bình Phước": "Đồng Nai", // merged into Đồng Nai, 2025
  "Tỉnh Bình Phước": "Đồng Nai",
  "Biên Hòa": "Đồng Nai", // Biên Hòa is a city within Đồng Nai, not its own province
  "Khánh Hòa": "Khánh Hòa",
  "Tỉnh Khánh Hòa": "Khánh Hòa",
  "Ninh Thuận": "Khánh Hòa", // merged into Khánh Hòa, 2025
  "Tỉnh Ninh Thuận": "Khánh Hòa",
  "Nha Trang": "Khánh Hòa", // Nha Trang is a city within Khánh Hòa, not its own province
  // Bà Rịa - Vũng Tàu and Bình Dương were fully absorbed into TP. Hồ Chí Minh, 2025 —
  // no longer separate provinces at all, so every old name/spelling routes here now.
  "Bà Rịa - Vũng Tàu": "TP. Hồ Chí Minh",
  "Bà Rịa–Vũng Tàu": "TP. Hồ Chí Minh",
  "Tỉnh Bà Rịa - Vũng Tàu": "TP. Hồ Chí Minh",
  "Vũng Tàu": "TP. Hồ Chí Minh",
  "Bình Dương": "TP. Hồ Chí Minh",
  "Tỉnh Bình Dương": "TP. Hồ Chí Minh",
  "Thanh Hóa": "Thanh Hóa",
  "Tỉnh Thanh Hóa": "Thanh Hóa",
  "Nghệ An": "Nghệ An",
  "Tỉnh Nghệ An": "Nghệ An",
  "Gia Lai": "Gia Lai",
  "Tỉnh Gia Lai": "Gia Lai",
  "Bình Định": "Gia Lai", // merged into Gia Lai, 2025
  "Tỉnh Bình Định": "Gia Lai",
  "Quy Nhơn": "Gia Lai", // Quy Nhơn is a city within the merged Gia Lai, not its own province
  "Lâm Đồng": "Lâm Đồng",
  "Tỉnh Lâm Đồng": "Lâm Đồng",
  "Đắk Nông": "Lâm Đồng", // merged into Lâm Đồng, 2025
  "Tỉnh Đắk Nông": "Lâm Đồng",
  "Bình Thuận": "Lâm Đồng", // merged into Lâm Đồng, 2025
  "Tỉnh Bình Thuận": "Lâm Đồng",
  "Tây Ninh": "Tây Ninh",
  "Tỉnh Tây Ninh": "Tây Ninh",
  "Long An": "Tây Ninh", // merged into Tây Ninh, 2025
  "Tỉnh Long An": "Tây Ninh",
  "Huế": "Huế", // unchanged by the 2025 merger
  "Thành phố Huế": "Huế",
  "Tỉnh Thừa Thiên Huế": "Huế",
  "Thừa Thiên Huế": "Huế",
};

/**
 * Since Vietnam's July 2025 district-level abolition, Nominatim's `address.city` often
 * holds the old district-level city name (e.g. "Thủ Đức") rather than the parent
 * province/municipality, so it no longer reliably matches PROVINCES. `display_name` still
 * lists the real province/city as the segment right before the postcode and country, so
 * it's used as a second, more reliable source.
 */
function extractProvinceSegment(displayName: string): string | null {
  const parts = displayName.split(",").map((p) => p.trim()).filter(Boolean);
  while (parts.length && (parts[parts.length - 1] === "Việt Nam" || /^\d+$/.test(parts[parts.length - 1]))) {
    parts.pop();
  }
  return parts.length ? parts[parts.length - 1] : null;
}

function detectProvince(result: NominatimResult): string | null {
  const address = result.address;
  const candidates = [
    address?.city, address?.state, address?.county, address?.town, address?.village,
    extractProvinceSegment(result.display_name),
  ];
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
  onLocationDetected?: (location: { ward?: string; postalCode?: string; buildingName?: string }) => void;
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
      const province = detectProvince(s);
      if (province) onProvinceDetected(province);
    }
    onLocationDetected?.({
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
  return `${hour.opensAt}–${hour.closesAt}${hour.closesNextDay ? " (overnight)" : ""}`;
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
      const range = labels.length > 1 ? `${labels[0]}–${labels[labels.length - 1]}` : labels[0];
      return `${range} ${formatHourRange(hour)}`;
    })
    .join(" · ");
};

const createEmptyForm = (clusterCode: string): CreateClusterPayload => ({
  clusterCode,
  clusterName: "",
  venueType: "MALL",
  openingDate: "",
  countryCode: "VN",
  province: "",
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
    countryCode: cluster.countryCode ?? "VN",
    province: cluster.province,
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

/** Just a heading — no card/border, since the stepper above already shows the icon
 *  and step name; a second boxed header for the same step read as duplicated chrome. */
function FormSection({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-4">
        <h3 style={{ fontSize: "15px", fontWeight: 700, color: "var(--text-main)" }}>{title}</h3>
        <p style={{ fontSize: "12px", color: "var(--text-sub)", lineHeight: 1.4 }}>{description}</p>
      </div>
      {children}
    </section>
  );
}

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="mb-1.5 block" style={{ fontSize: "12px", fontWeight: 500, color: "var(--text-sub)" }}>
      {children}{required && <span className="text-rose-500"> *</span>}
    </label>
  );
}

// ── Wizard steps ─────────────────────────────────────────────────────────────

const WIZARD_STEPS: Array<{ title: string; icon: React.ElementType }> = [
  { title: "Cluster identity", icon: Building2 },
  { title: "Address & geolocation", icon: MapPin },
  { title: "Public contact", icon: Mail },
  { title: "Operating schedule", icon: Timer },
];

/** Validates only what's needed to safely leave a step — full cross-field validation
 *  still happens once at submit, since jumping via the stepper skips this. */
function validateStep(step: number, form: CreateClusterPayload): string | null {
  if (step === 0) {
    if (!form.clusterCode.trim()) return "Cluster code is required.";
    if (!/^[A-Z0-9][A-Z0-9-]{1,19}$/.test(form.clusterCode.trim().toUpperCase())) return "Cluster code must be 2-20 uppercase letters, numbers or hyphens.";
    if (form.clusterName.trim().length < 2) return "Cluster name must be at least 2 characters.";
    if (!form.venueType) return "Venue type is required.";
    return null;
  }
  if (step === 1) {
    if (form.address.trim().length < 10) return "A full address (at least 10 characters) is required.";
    if (!form.province) return "Province / city is required.";
    return null;
  }
  return null;
}

/** Icon-only — text labels for every step didn't fit the modal's width without
 *  overlapping, and duplicated the heading already shown above each step's fields. */
function ClusterWizardStepper({ current, maxReached, onJump }: { current: number; maxReached: number; onJump: (step: number) => void }) {
  return (
    <div className="mb-2 flex items-center" aria-label="Cluster setup steps">
      {WIZARD_STEPS.map((s, i) => {
        const state = i < current ? "done" : i === current ? "current" : "upcoming";
        const clickable = i <= maxReached;
        const Icon = s.icon;
        return (
          <div key={s.title} className="flex items-center" style={{ flex: i === WIZARD_STEPS.length - 1 ? "0 0 auto" : 1, minWidth: 0 }}>
            <button
              type="button"
              title={s.title}
              disabled={!clickable}
              onClick={() => onJump(i)}
              style={{ background: "none", border: "none", padding: 0, cursor: clickable ? "pointer" : "default", flexShrink: 0 }}
            >
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
                style={{
                  background: state === "done" ? "#2563eb" : state === "current" ? "rgba(37,99,235,0.12)" : "var(--bg-card)",
                  border: state === "current" ? "2px solid #2563eb" : "1px solid var(--border-color)",
                  color: state === "done" ? "#fff" : state === "current" ? "#2563eb" : "var(--text-sub)",
                }}
              >
                {state === "done" ? <Check size={16} /> : <Icon size={16} />}
              </span>
            </button>
            {i < WIZARD_STEPS.length - 1 && (
              <div className="mx-2" style={{ flex: 1, height: "1.5px", minWidth: "16px", background: i < current ? "#2563eb" : "var(--border-color)" }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Modal ─────────────────────────────────────────────────────────────────────

type ClusterWizardModalProps = {
  open: boolean;
  mode: "create" | "edit";
  clusterId?: number | null;
  onClose: () => void;
  onSaved: (cluster: ClusterResponse) => void;
};

export function ClusterWizardModal({ open, mode, clusterId, onClose, onSaved }: ClusterWizardModalProps) {
  const { isAdmin } = useRole();

  const [initial, setInitial] = useState<ClusterResponse | null>(null);
  const [form, setForm] = useState<CreateClusterPayload>(() => createEmptyForm(""));
  const [hydrating, setHydrating] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [uniformHours, setUniformHours] = useState(true);

  // Create mode gates steps progressively — the stepper only lets you jump to a step
  // you've already reached via Next. Edit mode starts fully unlocked (the loaded
  // cluster's data is already complete), so admins can jump straight to any section.
  const [step, setStep] = useState(0);
  const [maxStepReached, setMaxStepReached] = useState(0);
  const [stepError, setStepError] = useState<string | null>(null);

  const loadCluster = useCallback(async () => {
    if (clusterId) {
      setHydrating(true);
      setLoadError(null);
      try {
        const res = await movieApi.getClusterById(clusterId);
        setInitial(res.result);
        setForm(toFormState(res.result));
        setUniformHours(isUniformSchedule(res.result.operatingHours ?? []));
        setMaxStepReached(WIZARD_STEPS.length - 1);
      } catch (err: any) {
        setLoadError(err?.response?.data?.message ?? "Failed to load this cinema cluster.");
      } finally {
        setHydrating(false);
      }
    } else {
      try {
        const res = await movieApi.getClusters();
        // Based on the highest number actually used in an existing cluster code, not on
        // clusterId (the DB's internal auto-increment key) — those two drift apart the
        // moment anyone saves a code that doesn't match the suggested pattern, which then
        // makes the *next* suggestion jump to a number nobody used (e.g. CP27 → CP32).
        const usedNumbers = (res.result ?? [])
          .map((c) => c.clusterCode?.match(/(\d+)$/)?.[1])
          .filter((n): n is string => !!n)
          .map(Number);
        const nextCode = `CP-${String(Math.max(0, ...usedNumbers) + 1).padStart(3, "0")}`;
        setForm((current) => (current.clusterCode ? current : createEmptyForm(nextCode)));
      } catch {
        // Non-fatal — the CP-001 placeholder stays; the operator can edit the code manually before saving.
      }
    }
  }, [clusterId]);

  // Since this modal stays mounted between opens (toggled via `open`, not remounted per
  // route), every open needs its own fresh reset rather than relying on useState initializers.
  useEffect(() => {
    if (!open) return;
    setStep(0);
    setStepError(null);
    setSaveError(null);
    setInitial(null);
    setLoadError(null);
    if (!clusterId) {
      setForm(createEmptyForm(""));
      setUniformHours(true);
      setMaxStepReached(0);
    }
    loadCluster();
  }, [open, clusterId, loadCluster]);

  const inputStyle: React.CSSProperties = {
    fontSize: "13.5px",
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

  const goNext = () => {
    const err = validateStep(step, form);
    if (err) { setStepError(err); return; }
    setStepError(null);
    const next = Math.min(step + 1, WIZARD_STEPS.length - 1);
    setStep(next);
    setMaxStepReached((current) => Math.max(current, next));
  };
  const goPrev = () => {
    setStepError(null);
    setStep((current) => Math.max(current - 1, 0));
  };
  const jumpToStep = (target: number) => {
    if (target > maxStepReached) return;
    setStepError(null);
    setStep(target);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // The stepper lets you jump straight to an already-reached step without re-running
    // goNext's validation (e.g. step 0 → step 2 directly), so re-check every step here —
    // this is the only gate that's guaranteed to run right before the request goes out.
    for (let i = 0; i < WIZARD_STEPS.length; i++) {
      const err = validateStep(i, form);
      if (err) {
        setStep(i);
        setMaxStepReached((current) => Math.max(current, i));
        setStepError(err);
        return;
      }
    }
    setStepError(null);
    setSaveError(null);
    setSubmitting(true);
    const payload = {
      ...form,
      clusterCode: form.clusterCode.trim().toUpperCase(),
      openingDate: form.openingDate || undefined,
      // Status is a dedicated ADMIN activation toggle. DRAFT/PENDING_REVIEW
      // edits must not send status back through the general update contract.
      status: mode === "edit" && isAdmin
        && (initial?.status === "ACTIVE" || initial?.status === "INACTIVE")
        ? form.status
        : undefined,
    };
    try {
      const res = mode === "edit" && clusterId
        ? await movieApi.updateCluster(clusterId, payload)
        : await movieApi.createCluster(payload);
      onSaved(res.result);
      onClose();
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

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" onClick={onClose} />
      <div
        className="relative mx-4 flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl shadow-2xl"
        style={{ background: "var(--bg-main)", border: "1px solid var(--border-color)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b" style={{ borderColor: "var(--border-color)" }}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
              <MapPin size={16} className="text-blue-600" />
            </div>
            <h2 style={{ fontSize: "16px", color: "var(--text-main)", fontWeight: 600 }}>
              {mode === "create" ? "Add Cinema Cluster" : (initial?.clusterName || "Edit Cinema Cluster")}
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

        {hydrating ? (
          <div className="px-6 py-5"><LoadingState label="Loading cinema cluster…" /></div>
        ) : loadError ? (
          <div className="px-6 py-5"><ErrorBanner message={loadError} onRetry={loadCluster} /></div>
        ) : (
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="space-y-4 px-6 py-5">
            {/* Draft notice on create — every new cluster starts as Draft and needs Submit + Approve, regardless of role */}
            {mode === "create" && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl border" style={{ borderColor: "rgba(107,114,128,0.3)", background: "rgba(107,114,128,0.06)" }}>
                <Clock size={13} style={{ color: "#6b7280", flexShrink: 0 }} />
                <p style={{ fontSize: "12px", color: "#6b7280" }}>
                  Cụm rạp được lưu ở trạng thái <strong>Draft</strong> và cần Submit for Review trước khi hoạt động.
                </p>
              </div>
            )}

            <ClusterWizardStepper current={step} maxReached={maxStepReached} onJump={jumpToStep} />

            {stepError && (
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-rose-200 bg-rose-50">
                <AlertCircle size={14} className="text-rose-500 flex-shrink-0" />
                <p style={{ fontSize: "13px", color: "#e11d48" }}>{stepError}</p>
              </div>
            )}

            {step === 0 && (
            <FormSection title="Cluster identity" description="Stable identifiers used by scheduling, reporting and integrations.">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div><FieldLabel required>Cluster code</FieldLabel><input required pattern="[A-Z0-9][A-Z0-9-]{1,19}" value={form.clusterCode} disabled={mode === "edit" && initial?.status !== "DRAFT"} onChange={(e) => setForm({ ...form, clusterCode: e.target.value.toUpperCase() })} placeholder="CP-HCM-01" className="h-11 w-full rounded-lg border px-3 outline-none focus:border-blue-400 disabled:opacity-60" style={inputStyle} /></div>
                <div><FieldLabel required>Cluster name</FieldLabel><input required minLength={2} maxLength={100} value={form.clusterName} onChange={(e) => setForm({ ...form, clusterName: e.target.value })} placeholder="CinePrime Landmark 81" className="h-11 w-full rounded-lg border px-3 outline-none focus:border-blue-400" style={inputStyle} /></div>
                <div><FieldLabel>Opening date</FieldLabel><input type="date" value={form.openingDate ?? ""} onChange={(e) => setForm({ ...form, openingDate: e.target.value })} className="h-11 w-full rounded-lg border px-3 outline-none focus:border-blue-400" style={inputStyle} /></div>
                <div>
                  <FieldLabel required>Venue type</FieldLabel>
                  <select
                    required
                    value={form.venueType}
                    onChange={(e) => {
                      const venueType = e.target.value as ClusterVenueType;
                      // Floor only means something for a unit inside a larger building
                      // (mall / mixed-use) — a standalone building has none to report.
                      setForm((current) => ({ ...current, venueType, floorLocation: venueType === "STANDALONE" ? "" : current.floorLocation }));
                    }}
                    className="h-11 w-full rounded-lg border px-3 outline-none focus:border-blue-400" style={inputStyle}
                  >{VENUE_TYPES.map((type) => <option key={type.id} value={type.id}>{type.label}</option>)}</select>
                </div>
              </div>
              <p className="mt-2" style={{ fontSize: "10.5px", color: "var(--text-sub)" }}>
                Venue type is classification only — it drives the badge shown on the cluster list and future reporting, it doesn't change scheduling rules.
              </p>
            </FormSection>
            )}

            {step === 1 && (
            <FormSection title="Address & geolocation" description="Start with the address — selecting a suggestion below auto-fills ward and coordinates.">
              <div className="mb-4">
                <FieldLabel required>Full address · autocomplete</FieldLabel>
                <PlacesAddressInput required value={form.address} onChange={handleAddressChange} onProvinceDetected={(province) => setForm((current) => ({ ...current, province }))} onLocationDetected={(location) => setForm((current) => ({ ...current, ward: location.ward ?? current.ward, postalCode: location.postalCode ?? current.postalCode, buildingName: location.buildingName ?? current.buildingName }))} className="h-11 w-full rounded-lg border px-3 outline-none focus:border-blue-400" style={inputStyle} />
                {hasCoords ? (
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2" style={{ borderColor: "rgba(16,185,129,0.28)", background: "rgba(16,185,129,0.06)" }}>
                    <span className="flex items-center gap-1.5" style={{ fontSize: "11px", color: "#059669" }}><MapPin size={11} />{form.latitude!.toFixed(6)}, {form.longitude!.toFixed(6)}</span>
                    <a href={`https://www.openstreetmap.org/?mlat=${form.latitude}&mlon=${form.longitude}#map=16/${form.latitude}/${form.longitude}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: "11px", color: "#2563eb" }}>Verify on map ↗</a>
                  </div>
                ) : <p className="mt-2" style={{ fontSize: "10.5px", color: "#d97706" }}>Select a suggested address to verify coordinates before approval.</p>}
              </div>

              <p className="mb-2" style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-sub)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                Auto-filled — review and adjust if needed
              </p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div><FieldLabel>Building / venue</FieldLabel><input value={form.buildingName ?? ""} onChange={(e) => setForm({ ...form, buildingName: e.target.value })} placeholder="Landmark 81" className="h-11 w-full rounded-lg border px-3 outline-none focus:border-blue-400" style={inputStyle} /></div>
                {form.venueType !== "STANDALONE" && (
                  <div><FieldLabel>Floor</FieldLabel><input value={form.floorLocation ?? ""} onChange={(e) => setForm({ ...form, floorLocation: e.target.value })} placeholder="B1 / Level 5" className="h-11 w-full rounded-lg border px-3 outline-none focus:border-blue-400" style={inputStyle} /></div>
                )}
                <div><FieldLabel>Postal code</FieldLabel><input value={form.postalCode ?? ""} onChange={(e) => setForm({ ...form, postalCode: e.target.value })} placeholder="700000" className="h-11 w-full rounded-lg border px-3 outline-none focus:border-blue-400" style={inputStyle} /></div>
                <div><FieldLabel required>Province / City</FieldLabel><select required value={form.province} onChange={(e) => setForm({ ...form, province: e.target.value })} className="h-11 w-full rounded-lg border px-3 outline-none focus:border-blue-400" style={inputStyle}><option value="">Select province…</option>{PROVINCES.map((province) => <option key={province} value={province}>{province}</option>)}</select></div>
                <div><FieldLabel>Ward</FieldLabel><input value={form.ward ?? ""} onChange={(e) => setForm({ ...form, ward: e.target.value })} placeholder="Ward 22" className="h-11 w-full rounded-lg border px-3 outline-none focus:border-blue-400" style={inputStyle} /></div>
                <div><FieldLabel required>Country</FieldLabel><input value="Vietnam (VN)" readOnly className="h-11 w-full rounded-lg border px-3 opacity-70" style={inputStyle} /></div>
              </div>
            </FormSection>
            )}

            {step === 2 && (
            <FormSection title="Public contact" description="The chain hotline and support email are managed centrally and cannot be overridden per cluster.">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div><FieldLabel>Public email</FieldLabel><div className="flex h-11 items-center gap-2 rounded-lg border px-3 opacity-75" style={inputStyle}><Mail size={13} />contact@cineprime.vn <span className="ml-auto" style={{ fontSize: "10px", color: "var(--text-sub)" }}>Centralized</span></div></div>
                <div><FieldLabel>Chain hotline</FieldLabel><div className="flex h-11 items-center gap-2 rounded-lg border px-3 opacity-75" style={inputStyle}><Phone size={13} />19001000 <span className="ml-auto" style={{ fontSize: "10px", color: "var(--text-sub)" }}>Centralized</span></div></div>
              </div>
            </FormSection>
            )}

            {step === 3 && (
            <FormSection title="Operating schedule" description="Local business hours used by scheduling and customer-facing availability.">
              <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
                <div><FieldLabel required>Timezone</FieldLabel><div className="flex h-11 min-w-[200px] items-center gap-2 rounded-lg border px-3" style={inputStyle}><Globe2 size={13} />Asia/Ho_Chi_Minh</div></div>
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
                  <div className="overflow-hidden rounded-lg border" style={{ borderColor: "var(--border-color)" }}>
                    <div
                      className="grid items-center gap-2 px-3 py-2.5"
                      style={{ gridTemplateColumns: "64px 68px minmax(80px,1fr) 16px minmax(80px,1fr) 84px" }}
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
                  <div className="overflow-hidden rounded-lg border" style={{ borderColor: "var(--border-color)" }}>
                    <div
                      className="grid items-center gap-2 px-3 py-2"
                      style={{ gridTemplateColumns: "40px 68px minmax(80px,1fr) 16px minmax(80px,1fr) 84px", background: "rgba(128,128,128,0.05)" }}
                    >
                      <span style={{ fontSize: "9.5px", fontWeight: 700, color: "var(--text-sub)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Day</span>
                      <span style={{ fontSize: "9.5px", fontWeight: 700, color: "var(--text-sub)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Closed</span>
                      <span style={{ fontSize: "9.5px", fontWeight: 700, color: "var(--text-sub)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Opens</span>
                      <span />
                      <span style={{ fontSize: "9.5px", fontWeight: 700, color: "var(--text-sub)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Closes</span>
                      <span style={{ fontSize: "9.5px", fontWeight: 700, color: "var(--text-sub)", textTransform: "uppercase", letterSpacing: "0.05em" }} title="Enable when this day's closing time falls after midnight, e.g. opens 10:00, closes 01:00">Overnight</span>
                    </div>
                    {OPERATING_DAYS.map(({ id, label }) => {
                      const hours = form.operatingHours.find((hour) => hour.dayOfWeek === id)!;
                      return (
                        <div
                          key={id}
                          className="grid items-center gap-2 px-3 py-2.5"
                          style={{
                            gridTemplateColumns: "40px 68px minmax(80px,1fr) 16px minmax(80px,1fr) 84px",
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
            )}

            {/* Status toggle — chỉ ADMIN khi edit ACTIVE/INACTIVE, sống cùng bước cuối */}
            {step === 3 && showStatusToggle && (
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
          </div>

          <div className="sticky bottom-0 flex items-center justify-between gap-3 border-t px-6 py-4" style={{ borderColor: "var(--border-color)", background: "var(--bg-main)" }}>
            <button
              type="button" onClick={onClose} disabled={submitting}
              className="px-4 py-2.5 rounded-xl border transition-colors hover:opacity-80 disabled:opacity-50"
              style={{ fontSize: "13.5px", color: "var(--text-sub)", borderColor: "var(--border-color)" }}
            >
              Cancel
            </button>
            <div className="flex gap-3">
              {step > 0 && (
                <button
                  type="button" onClick={goPrev} disabled={submitting}
                  className="px-5 py-2.5 rounded-xl border transition-colors hover:opacity-80 disabled:opacity-50"
                  style={{ fontSize: "14px", borderColor: "var(--border-color)", color: "var(--text-main)" }}
                >
                  ← Previous
                </button>
              )}
              {step < WIZARD_STEPS.length - 1 ? (
                <button
                  key="next-button"
                  type="button" onClick={goNext}
                  className="px-5 py-2.5 rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                  style={{ fontSize: "14px", fontWeight: 600 }}
                >
                  Next →
                </button>
              ) : (
                <button
                  key="submit-button"
                  type="submit" disabled={submitting}
                  className="px-5 py-2.5 rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-60"
                  style={{ fontSize: "14px", fontWeight: 600 }}
                >
                  {submitting ? "Saving…" : mode === "create" ? "Create Cluster" : "Save Changes"}
                </button>
              )}
            </div>
          </div>
        </form>
        )}
      </div>
    </div>
  );
}
