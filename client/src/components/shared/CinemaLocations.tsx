import { useState, useEffect } from "react";
import { MapPin, Building2, Armchair, Phone, ArrowRight, RefreshCw } from "lucide-react";
import { movieApi, type ClusterResponse } from "../../api/movieApi";

const MOCK_CLUSTERS: ClusterResponse[] = [
  { clusterId: 1, clusterName: "CinePrime Quận 1",    province: "TP. Hồ Chí Minh", address: "123 Nguyễn Huệ, Quận 1",        phoneNumber: "028 3822 1234", status: "ACTIVE", totalRooms: 5, totalSeats: 650 },
  { clusterId: 2, clusterName: "CinePrime Thủ Đức",   province: "TP. Hồ Chí Minh", address: "456 Võ Văn Ngân, TP. Thủ Đức", phoneNumber: "028 3896 5678", status: "ACTIVE", totalRooms: 4, totalSeats: 480 },
  { clusterId: 3, clusterName: "CinePrime Hoàn Kiếm", province: "Hà Nội",           address: "78 Hàng Bài, Hoàn Kiếm",       phoneNumber: "024 3936 9012", status: "ACTIVE", totalRooms: 6, totalSeats: 820 },
  { clusterId: 4, clusterName: "CinePrime Cầu Giấy",  province: "Hà Nội",           address: "22 Xuân Thủy, Cầu Giấy",      phoneNumber: "024 3768 3456", status: "ACTIVE", totalRooms: 4, totalSeats: 510 },
  { clusterId: 5, clusterName: "CinePrime Hải Châu",  province: "Đà Nẵng",          address: "30 Trần Phú, Hải Châu",        phoneNumber: "0236 382 7890", status: "ACTIVE", totalRooms: 3, totalSeats: 360 },
  { clusterId: 6, clusterName: "CinePrime Ninh Kiều", province: "Cần Thơ",          address: "15 Hai Bà Trưng, Ninh Kiều",  phoneNumber: "0292 381 2345", status: "ACTIVE", totalRooms: 2, totalSeats: 220 },
];

export function CinemaLocations() {
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
      .catch(() => {
        setClusters(MOCK_CLUSTERS);
        setActiveProvince(MOCK_CLUSTERS[0].province);
      })
      .finally(() => setLoading(false));
  }, []);

  const provinces = Array.from(new Set(clusters.map((c) => c.province)));
  const visibleClusters = clusters.filter((c) => c.province === activeProvince);

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
