import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MapPin, Building2, Armchair, Phone, ArrowRight, Search } from "lucide-react";
import type { ClusterResponse } from "../../api/movieApi";
import { mockClusters } from "../../data/mockClusters";

const clusters = mockClusters.filter((c) => c.status === "ACTIVE");

export default function CinemasPage() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [activeProvince, setActiveProvince] = useState("All");

  const provinces = useMemo(() => ["All", ...Array.from(new Set(clusters.map((c) => c.province)))], []);

  // Same localStorage keys the search bar's location picker uses, so the
  // chosen cinema flows through to Movies and pre-selects it on Showtime page.
  const handleViewShowtimes = (cluster: ClusterResponse) => {
    localStorage.setItem("cp_province", cluster.province);
    localStorage.setItem("cp_cluster", JSON.stringify(cluster));
    navigate("/movies");
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return clusters.filter((c) => {
      const matchesProvince = activeProvince === "All" || c.province === activeProvince;
      const matchesQuery = !q || c.clusterName.toLowerCase().includes(q) || c.address.toLowerCase().includes(q);
      return matchesProvince && matchesQuery;
    });
  }, [query, activeProvince]);

  return (
    <div className="min-h-screen pt-16" style={{ backgroundColor: "#050505" }}>
      {/* Header */}
      <div className="border-b border-white/10 px-6 pb-8 pt-10">
        <div className="mx-auto max-w-7xl">
          <div className="mb-1 flex items-center gap-2.5">
            <MapPin size={20} style={{ color: "#FFD700" }} />
            <span style={{ color: "#FFD700", fontSize: "0.7rem", letterSpacing: "0.25em", fontWeight: 700, textTransform: "uppercase" }}>
              Nationwide Network
            </span>
          </div>
          <h1 className="text-3xl font-extrabold text-white sm:text-4xl">Our Cinemas</h1>
          <p className="mt-1.5 text-sm text-white/45">
            {clusters.length} cinema clusters across {provinces.length - 1} cities
          </p>

          {/* Search */}
          <div
            className="mt-6 flex items-center gap-3 rounded-2xl px-4"
            style={{ border: "1px solid rgba(255,215,0,0.2)", backgroundColor: "rgba(255,255,255,0.04)" }}
          >
            <Search size={16} style={{ color: "rgba(255,215,0,0.6)" }} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by cinema name or address..."
              className="w-full bg-transparent py-3.5 text-sm text-white outline-none placeholder-white/35"
            />
          </div>

          {/* Province tabs */}
          <div className="mt-5 flex gap-2.5 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
            {provinces.map((p) => (
              <button
                key={p}
                onClick={() => setActiveProvince(p)}
                className="whitespace-nowrap rounded-full px-4 py-1.5 text-[13px] transition-all duration-200 hover:scale-105 cursor-pointer"
                style={
                  activeProvince === p
                    ? { background: "linear-gradient(135deg, #FFD700, #FFA500)", color: "#050505", fontWeight: 700 }
                    : { border: "1px solid rgba(255,255,255,0.12)", backgroundColor: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.55)" }
                }
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="mx-auto max-w-7xl px-6 py-10">
        {filtered.length === 0 ? (
          <div className="py-24 text-center text-white/40">No cinemas found.</div>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((cluster) => (
              <div
                key={cluster.clusterId}
                onClick={() => handleViewShowtimes(cluster)}
                className="group relative cursor-pointer rounded-2xl p-6 transition-all duration-300 hover:-translate-y-1"
                style={{ border: "1px solid rgba(255,255,255,0.07)", backgroundColor: "rgba(255,255,255,0.03)" }}
                onMouseEnter={(e) => {
                  const el = e.currentTarget as HTMLDivElement;
                  el.style.borderColor = "rgba(255,215,0,0.2)";
                  el.style.backgroundColor = "rgba(255,215,0,0.04)";
                  el.style.boxShadow = "0 20px 50px rgba(0,0,0,0.5)";
                }}
                onMouseLeave={(e) => {
                  const el = e.currentTarget as HTMLDivElement;
                  el.style.borderColor = "rgba(255,255,255,0.07)";
                  el.style.backgroundColor = "rgba(255,255,255,0.03)";
                  el.style.boxShadow = "none";
                }}
              >
                <div className="mb-5 flex items-start gap-4">
                  <div
                    className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl"
                    style={{ background: "rgba(255,215,0,0.1)", border: "1px solid rgba(255,215,0,0.15)" }}
                  >
                    <MapPin size={18} style={{ color: "#FFD700" }} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-base font-bold text-white">{cluster.clusterName}</h3>
                    <p className="mt-0.5 text-[13px] text-white/40">{cluster.address}</p>
                    <p className="mt-0.5 text-[11px] uppercase tracking-wider text-[#FFD700]/70">{cluster.province}</p>
                  </div>
                </div>

                <div
                  className="mb-4 flex items-center gap-4 py-3"
                  style={{ borderTop: "1px solid rgba(255,255,255,0.06)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}
                >
                  <div className="flex items-center gap-1.5">
                    <Building2 size={13} style={{ color: "rgba(255,255,255,0.35)" }} />
                    <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.5)" }}>
                      <strong className="text-white">{cluster.totalRooms ?? "—"}</strong> screens
                    </span>
                  </div>
                  <div style={{ width: "1px", height: "14px", background: "rgba(255,255,255,0.1)" }} />
                  <div className="flex items-center gap-1.5">
                    <Armchair size={13} style={{ color: "rgba(255,255,255,0.35)" }} />
                    <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.5)" }}>
                      <strong className="text-white">{cluster.totalSeats?.toLocaleString() ?? "—"}</strong> seats
                    </span>
                  </div>
                  {cluster.phoneNumber && (
                    <>
                      <div style={{ width: "1px", height: "14px", background: "rgba(255,255,255,0.1)" }} />
                      <div className="flex items-center gap-1.5">
                        <Phone size={12} style={{ color: "rgba(255,255,255,0.35)" }} />
                        <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)" }}>{cluster.phoneNumber}</span>
                      </div>
                    </>
                  )}
                </div>

                <button
                  className="flex items-center gap-2 transition-all duration-200 group-hover:gap-3"
                  style={{ color: "#FFD700", fontSize: "0.82rem", fontWeight: 600, background: "none", border: "none", cursor: "pointer", padding: 0 }}
                >
                  View showtimes <ArrowRight size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
