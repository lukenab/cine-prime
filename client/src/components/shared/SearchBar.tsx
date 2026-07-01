import { useState, useEffect, useRef } from "react";
import { Search, SlidersHorizontal, MapPin, ChevronDown } from "lucide-react";
import { movieApi, type ClusterResponse } from "../../api/movieApi";

const GENRES = ["All", "Action", "Drama", "Comedy", "Horror", "Sci-Fi", "Romance", "Thriller", "Animation"];

// ── Mock clusters (fallback khi backend chưa có) ──────────────────────────────
const MOCK_CLUSTERS: ClusterResponse[] = [
  { clusterId: 1, clusterName: "CinePrime Quận 1",     province: "TP. Hồ Chí Minh", address: "123 Nguyễn Huệ, Quận 1",        status: "ACTIVE" },
  { clusterId: 2, clusterName: "CinePrime Thủ Đức",    province: "TP. Hồ Chí Minh", address: "456 Võ Văn Ngân, TP. Thủ Đức", status: "ACTIVE" },
  { clusterId: 3, clusterName: "CinePrime Hoàn Kiếm",  province: "Hà Nội",           address: "78 Hàng Bài, Hoàn Kiếm",       status: "ACTIVE" },
  { clusterId: 4, clusterName: "CinePrime Cầu Giấy",   province: "Hà Nội",           address: "22 Xuân Thủy, Cầu Giấy",      status: "ACTIVE" },
  { clusterId: 5, clusterName: "CinePrime Hải Châu",   province: "Đà Nẵng",          address: "30 Trần Phú, Hải Châu",        status: "ACTIVE" },
  { clusterId: 6, clusterName: "CinePrime Ninh Kiều",  province: "Cần Thơ",          address: "15 Hai Bà Trưng, Ninh Kiều",  status: "ACTIVE" },
];

// ── Location Dropdown ─────────────────────────────────────────────────────────
type LocationDropdownProps = {
  clusters: ClusterResponse[];
  selectedProvince: string;
  selectedCluster: ClusterResponse | null;
  onSelect: (province: string, cluster: ClusterResponse | null) => void;
};

function LocationDropdown({ clusters, selectedProvince, selectedCluster, onSelect }: LocationDropdownProps) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"province" | "cluster">("province");
  const ref = useRef<HTMLDivElement>(null);

  const provinces = Array.from(new Set(clusters.map((c) => c.province)));
  const clustersInProvince = clusters.filter((c) => c.province === selectedProvince && c.status === "ACTIVE");

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const label = selectedCluster
    ? selectedCluster.clusterName
    : selectedProvince
    ? selectedProvince
    : "Select location";

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => { setOpen((o) => !o); setStep(selectedProvince ? "cluster" : "province"); }}
        className="flex items-center gap-2 px-4 py-2 rounded-xl transition-all duration-200 whitespace-nowrap"
        style={{
          border: "1px solid rgba(255,215,0,0.25)",
          backgroundColor: "rgba(255,215,0,0.06)",
          color: selectedCluster || selectedProvince ? "#FFD700" : "rgba(255,255,255,0.5)",
          fontSize: "0.85rem",
          fontWeight: selectedCluster ? 600 : 400,
        }}
      >
        <MapPin size={14} style={{ color: "#FFD700", flexShrink: 0 }} />
        <span>{label}</span>
        <ChevronDown size={13} style={{ opacity: 0.6, transition: "transform 0.2s", transform: open ? "rotate(180deg)" : "rotate(0deg)" }} />
      </button>

      {open && (
        <div
          className="absolute top-full left-0 mt-2 rounded-2xl shadow-2xl overflow-hidden z-50"
          style={{
            width: "260px",
            background: "#111",
            border: "1px solid rgba(255,215,0,0.15)",
          }}
        >
          {/* Header */}
          <div className="px-4 py-3 border-b" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
            {step === "cluster" && selectedProvince ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setStep("province")}
                  className="text-xs hover:text-yellow-400 transition-colors"
                  style={{ color: "rgba(255,255,255,0.4)" }}
                >
                  ← Provinces
                </button>
                <span style={{ color: "rgba(255,255,255,0.2)", fontSize: "12px" }}>/</span>
                <span style={{ color: "#FFD700", fontSize: "12px", fontWeight: 600 }}>{selectedProvince}</span>
              </div>
            ) : (
              <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)", letterSpacing: "0.1em", textTransform: "uppercase" }}>
                Select Province
              </p>
            )}
          </div>

          {/* Province list */}
          {step === "province" && (
            <div className="py-1 max-h-56 overflow-y-auto">
              {/* All locations option */}
              <button
                onClick={() => { onSelect("", null); setOpen(false); }}
                className="w-full text-left px-4 py-2.5 transition-colors hover:bg-white/5"
                style={{ fontSize: "13px", color: !selectedProvince ? "#FFD700" : "rgba(255,255,255,0.7)" }}
              >
                All Locations
              </button>
              {provinces.map((p) => (
                <button
                  key={p}
                  onClick={() => { onSelect(p, null); setStep("cluster"); }}
                  className="w-full text-left px-4 py-2.5 transition-colors hover:bg-white/5 flex items-center justify-between"
                  style={{ fontSize: "13px", color: selectedProvince === p ? "#FFD700" : "rgba(255,255,255,0.7)" }}
                >
                  <span>{p}</span>
                  <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.3)" }}>
                    {clusters.filter((c) => c.province === p).length} rạp
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Cluster list */}
          {step === "cluster" && selectedProvince && (
            <div className="py-1 max-h-56 overflow-y-auto">
              <button
                onClick={() => { onSelect(selectedProvince, null); setOpen(false); }}
                className="w-full text-left px-4 py-2.5 transition-colors hover:bg-white/5"
                style={{ fontSize: "13px", color: !selectedCluster ? "#FFD700" : "rgba(255,255,255,0.5)" }}
              >
                All cinemas in {selectedProvince}
              </button>
              {clustersInProvince.map((c) => (
                <button
                  key={c.clusterId}
                  onClick={() => { onSelect(selectedProvince, c); setOpen(false); }}
                  className="w-full text-left px-4 py-2.5 transition-colors hover:bg-white/5"
                  style={{ fontSize: "13px", color: selectedCluster?.clusterId === c.clusterId ? "#FFD700" : "rgba(255,255,255,0.7)" }}
                >
                  <p style={{ fontWeight: 500 }}>{c.clusterName}</p>
                  <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.35)", marginTop: "1px" }}>{c.address}</p>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main SearchBar ─────────────────────────────────────────────────────────────
export function SearchBar() {
  const [query, setQuery] = useState("");
  const [activeGenre, setActiveGenre] = useState("All");
  const [clusters, setClusters] = useState<ClusterResponse[]>([]);
  const [selectedProvince, setSelectedProvince] = useState<string>(() =>
    localStorage.getItem("cp_province") ?? ""
  );
  const [selectedCluster, setSelectedCluster] = useState<ClusterResponse | null>(() => {
    try {
      const saved = localStorage.getItem("cp_cluster");
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  });

  useEffect(() => {
    movieApi.getClusters()
      .then((res) => setClusters((res.result ?? []).filter((c) => c.status === "ACTIVE")))
      .catch(() => setClusters(MOCK_CLUSTERS));
  }, []);

  const handleLocationSelect = (province: string, cluster: ClusterResponse | null) => {
    setSelectedProvince(province);
    setSelectedCluster(cluster);
    localStorage.setItem("cp_province", province);
    localStorage.setItem("cp_cluster", cluster ? JSON.stringify(cluster) : "");
  };

  return (
    <section
      className="relative z-10 w-full"
      style={{ backgroundColor: "#050505", paddingTop: "0", marginTop: "-2px" }}
    >
      <div className="max-w-5xl mx-auto px-6" style={{ paddingBottom: "48px" }}>
        {/* Search row */}
        <div
          className="relative flex items-center gap-3 rounded-2xl overflow-visible mb-6 px-4"
          style={{
            border: "1px solid rgba(255,215,0,0.2)",
            backgroundColor: "rgba(255,255,255,0.04)",
            backdropFilter: "blur(16px)",
          }}
        >
          {/* Location picker */}
          <LocationDropdown
            clusters={clusters}
            selectedProvince={selectedProvince}
            selectedCluster={selectedCluster}
            onSelect={handleLocationSelect}
          />

          {/* Divider */}
          <div style={{ width: "1px", height: "24px", background: "rgba(255,255,255,0.1)", flexShrink: 0 }} />

          {/* Search input */}
          <div className="relative flex-1 flex items-center">
            <Search size={16} className="absolute left-0 pointer-events-none" style={{ color: "rgba(255,215,0,0.5)" }} />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search movies by name or genre..."
              className="w-full bg-transparent outline-none pl-6"
              style={{ padding: "18px 0 18px 24px", color: "white", fontSize: "0.95rem" }}
            />
          </div>

          {/* Filter button */}
          <button
            className="flex items-center gap-2 px-4 py-2 rounded-xl transition-all duration-200 hover:brightness-110 flex-shrink-0"
            style={{
              background: "linear-gradient(135deg, #FFD700, #FFA500)",
              color: "#050505",
              fontWeight: 700,
              fontSize: "0.85rem",
            }}
          >
            <SlidersHorizontal size={14} />
            <span className="hidden sm:inline">Filters</span>
          </button>
        </div>

        {/* Selected location indicator */}
        {(selectedProvince || selectedCluster) && (
          <div className="flex items-center gap-2 mb-4">
            <MapPin size={12} style={{ color: "#FFD700" }} />
            <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.5)" }}>
              Showing results for{" "}
              <span style={{ color: "#FFD700", fontWeight: 600 }}>
                {selectedCluster ? selectedCluster.clusterName : selectedProvince}
              </span>
            </span>
            <button
              onClick={() => handleLocationSelect("", null)}
              style={{ fontSize: "11px", color: "rgba(255,255,255,0.3)", marginLeft: "4px" }}
              className="hover:text-white transition-colors"
            >
              × clear
            </button>
          </div>
        )}

        {/* Genre pills */}
        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
          {GENRES.map((genre) => (
            <button
              key={genre}
              onClick={() => setActiveGenre(genre)}
              className="whitespace-nowrap px-5 py-2 rounded-full transition-all duration-200 hover:scale-105"
              style={
                activeGenre === genre
                  ? {
                      background: "linear-gradient(135deg, #FFD700, #FFA500)",
                      color: "#050505",
                      fontWeight: 700,
                      fontSize: "0.8rem",
                      letterSpacing: "0.05em",
                    }
                  : {
                      border: "1px solid rgba(255,255,255,0.12)",
                      backgroundColor: "rgba(255,255,255,0.05)",
                      color: "rgba(255,255,255,0.55)",
                      fontSize: "0.8rem",
                      letterSpacing: "0.05em",
                    }
              }
            >
              {genre}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
