import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { MapPin, Building2, Armchair, Phone, ArrowRight, RefreshCw } from "lucide-react";
import { movieApi, type ClusterResponse } from "../../api/movieApi";

export function CinemaLocations() {
  const navigate = useNavigate();
  const [clusters, setClusters] = useState<ClusterResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeProvince, setActiveProvince] = useState<string>("");

  useEffect(() => {
    movieApi.getClusters()
      .then((res) => {
        const active = (res.result ?? []).filter((c) => c.status === "ACTIVE");
        setClusters(active);
        if (active.length > 0) setActiveProvince(active[0].province);
      })
      .catch(() => setClusters([]))
      .finally(() => setLoading(false));
  }, []);

  const provinces = Array.from(new Set(clusters.map((c) => c.province)));
  const visibleClusters = clusters.filter((c) => c.province === activeProvince);

  const handleViewShowtimes = (cluster: ClusterResponse) => {
    localStorage.setItem("cp_province", cluster.province);
    localStorage.setItem("cp_cluster", JSON.stringify(cluster));
    navigate("/movies");
  };

  return (
    <section
      style={{
        backgroundColor: "#050505",
        paddingTop: "80px",
        paddingBottom: "80px",
        borderTop: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      <div className="max-w-7xl mx-auto px-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10">
          <div>
            <span
              style={{
                color: "#FFD700",
                fontSize: "0.7rem",
                letterSpacing: "0.25em",
                fontWeight: 700,
                textTransform: "uppercase",
              }}
            >
              Nationwide Network
            </span>
            <h2
              style={{
                color: "white",
                fontWeight: 800,
                fontSize: "clamp(1.6rem, 4vw, 2.4rem)",
                marginTop: "10px",
                lineHeight: 1.15,
              }}
            >
              Our{" "}
              <span
                style={{
                  background: "linear-gradient(135deg, #FFD700, #FFA500)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                Locations
              </span>
            </h2>
            <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.9rem", marginTop: "8px" }}>
              {clusters.length} cinema clusters across {provinces.length} cities
            </p>
          </div>

          {/* Province tabs */}
          {!loading && (
            <div className="flex flex-wrap gap-2">
              {provinces.map((p) => (
                <button
                  key={p}
                  onClick={() => setActiveProvince(p)}
                  className="px-4 py-1.5 rounded-full transition-all duration-200 text-sm"
                  style={
                    activeProvince === p
                      ? {
                          background: "linear-gradient(135deg, #FFD700, #FFA500)",
                          color: "#050505",
                          fontWeight: 700,
                          fontSize: "0.8rem",
                        }
                      : {
                          border: "1px solid rgba(255,255,255,0.12)",
                          backgroundColor: "rgba(255,255,255,0.04)",
                          color: "rgba(255,255,255,0.5)",
                          fontSize: "0.8rem",
                        }
                  }
                >
                  {p}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-16">
            <RefreshCw size={20} className="animate-spin" style={{ color: "rgba(255,255,255,0.3)" }} />
          </div>
        )}

        {/* Cluster cards */}
        {!loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {visibleClusters.map((cluster) => (
              <div
                key={cluster.clusterId}
                onClick={() => handleViewShowtimes(cluster)}
                className="group relative rounded-2xl p-6 cursor-pointer transition-all duration-300 hover:-translate-y-1"
                style={{
                  border: "1px solid rgba(255,255,255,0.07)",
                  backgroundColor: "rgba(255,255,255,0.03)",
                }}
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
                {/* Icon + Name */}
                <div className="flex items-start gap-4 mb-5">
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: "rgba(255,215,0,0.1)", border: "1px solid rgba(255,215,0,0.15)" }}
                  >
                    <MapPin size={18} style={{ color: "#FFD700" }} />
                  </div>
                  <div className="min-w-0">
                    <h3
                      style={{
                        color: "white",
                        fontWeight: 700,
                        fontSize: "1rem",
                        lineHeight: 1.3,
                      }}
                    >
                      {cluster.clusterName}
                    </h3>
                    <p
                      style={{
                        color: "rgba(255,255,255,0.4)",
                        fontSize: "0.78rem",
                        marginTop: "3px",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {cluster.address}
                    </p>
                  </div>
                </div>

                {/* Stats */}
                <div
                  className="flex items-center gap-4 py-3 mb-4"
                  style={{ borderTop: "1px solid rgba(255,255,255,0.06)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}
                >
                  <div className="flex items-center gap-1.5">
                    <Building2 size={13} style={{ color: "rgba(255,255,255,0.35)" }} />
                    <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.5)" }}>
                      <strong style={{ color: "white" }}>{cluster.totalRooms ?? "—"}</strong> screens
                    </span>
                  </div>
                  <div style={{ width: "1px", height: "14px", background: "rgba(255,255,255,0.1)" }} />
                  <div className="flex items-center gap-1.5">
                    <Armchair size={13} style={{ color: "rgba(255,255,255,0.35)" }} />
                    <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.5)" }}>
                      <strong style={{ color: "white" }}>{cluster.totalSeats?.toLocaleString() ?? "—"}</strong> seats
                    </span>
                  </div>
                  {cluster.phoneNumber && (
                    <>
                      <div style={{ width: "1px", height: "14px", background: "rgba(255,255,255,0.1)" }} />
                      <div className="flex items-center gap-1.5">
                        <Phone size={12} style={{ color: "rgba(255,255,255,0.35)" }} />
                        <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)" }}>
                          {cluster.phoneNumber}
                        </span>
                      </div>
                    </>
                  )}
                </div>

                {/* CTA */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleViewShowtimes(cluster);
                  }}
                  className="flex items-center gap-2 transition-all duration-200 group-hover:gap-3"
                  style={{ color: "#FFD700", fontSize: "0.82rem", fontWeight: 600, background: "none", border: "none", cursor: "pointer", padding: 0 }}
                >
                  View showtimes
                  <ArrowRight size={14} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Empty */}
        {!loading && visibleClusters.length === 0 && (
          <div className="text-center py-16" style={{ color: "rgba(255,255,255,0.3)", fontSize: "14px" }}>
            No cinemas available in {activeProvince}.
          </div>
        )}
      </div>
    </section>
  );
}
