import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  MapPin,
  Building2,
  Armchair,
  Phone,
  ArrowRight,
  Search,
  Heart,
  Navigation,
  Loader2,
} from "lucide-react";
import { movieApi, type ClusterResponse } from "../../api/movieApi";

const FAVORITE_CINEMAS_KEY = "cp_favorite_clusters";

function readFavoriteCinemaIds(): number[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(FAVORITE_CINEMAS_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((id): id is number => Number.isInteger(id)) : [];
  } catch {
    return [];
  }
}

function distanceInKm(
  origin: { latitude: number; longitude: number },
  destination: { latitude: number; longitude: number }
) {
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const deltaLatitude = toRadians(destination.latitude - origin.latitude);
  const deltaLongitude = toRadians(destination.longitude - origin.longitude);
  const latitudeA = toRadians(origin.latitude);
  const latitudeB = toRadians(destination.latitude);
  const h =
    Math.sin(deltaLatitude / 2) ** 2
    + Math.cos(latitudeA) * Math.cos(latitudeB) * Math.sin(deltaLongitude / 2) ** 2;
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export default function CinemasPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const [activeProvince, setActiveProvince] = useState("All");
  const [clusters, setClusters] = useState<ClusterResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [favoriteIds, setFavoriteIds] = useState<number[]>(readFavoriteCinemaIds);
  const [currentLocation, setCurrentLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState("");

  useEffect(() => {
    movieApi.getClusters()
      .then((res) => setClusters((res.result ?? []).filter((c) => c.status === "ACTIVE")))
      .catch(() => setClusters([]))
      .finally(() => setLoading(false));
  }, []);

  const provinces = useMemo(() => ["All", ...Array.from(new Set(clusters.map((c) => c.province)))], [clusters]);

  const handleViewShowtimes = (cluster: ClusterResponse) => {
    localStorage.setItem("cp_province", cluster.province);
    localStorage.setItem("cp_cluster", JSON.stringify(cluster));
    navigate(`/cinemas/${cluster.clusterId}/showtimes`);
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return clusters
      .filter((c) => {
        const matchesProvince = activeProvince === "All" || c.province === activeProvince;
        const matchesQuery = !q || c.clusterName.toLowerCase().includes(q) || c.address.toLowerCase().includes(q);
        return matchesProvince && matchesQuery;
      })
      .sort((a, b) => {
        const favoriteDifference =
          Number(favoriteIds.includes(b.clusterId)) - Number(favoriteIds.includes(a.clusterId));
        if (favoriteDifference !== 0) return favoriteDifference;
        if (currentLocation && a.latitude != null && a.longitude != null && b.latitude != null && b.longitude != null) {
          return distanceInKm(currentLocation, { latitude: a.latitude, longitude: a.longitude })
            - distanceInKm(currentLocation, { latitude: b.latitude, longitude: b.longitude });
        }
        return a.clusterName.localeCompare(b.clusterName);
      });
  }, [clusters, query, activeProvince, currentLocation, favoriteIds]);

  function toggleFavorite(clusterId: number) {
    setFavoriteIds((current) => {
      const next = current.includes(clusterId)
        ? current.filter((id) => id !== clusterId)
        : [...current, clusterId];
      localStorage.setItem(FAVORITE_CINEMAS_KEY, JSON.stringify(next));
      return next;
    });
  }

  function findNearbyCinemas() {
    if (!navigator.geolocation) {
      setLocationError("Location is not supported by this browser.");
      return;
    }
    setLocating(true);
    setLocationError("");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCurrentLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        setActiveProvince("All");
        setLocating(false);
      },
      () => {
        setLocationError("Allow location access to sort cinemas by distance.");
        setLocating(false);
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 }
    );
  }

  return (
    <div className="min-h-screen pt-16" style={{ backgroundColor: "#050505" }}>
      {/* Header */}
      <div className="border-b border-white/10 px-6 pb-8 pt-10">
        <div className="mx-auto max-w-7xl">
          <div className="mb-1 flex items-center gap-2.5">
            <MapPin size={20} style={{ color: "#60A5FA" }} />
            <span style={{ color: "#60A5FA", fontSize: "0.7rem", letterSpacing: "0.25em", fontWeight: 700, textTransform: "uppercase" }}>
              Nationwide Network
            </span>
          </div>
          <h1 className="text-3xl font-extrabold text-white sm:text-4xl">Our Cinemas</h1>
          <p className="mt-1.5 text-sm text-white/45">
            {clusters.length} cinema clusters across {provinces.length - 1} cities
          </p>

          {/* Search */}
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <div
              className="flex flex-1 items-center gap-3 rounded-2xl px-4"
              style={{ border: "1px solid rgba(59,130,246,0.25)", backgroundColor: "rgba(255,255,255,0.04)" }}
            >
              <Search size={16} style={{ color: "rgba(96,165,250,0.8)" }} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by cinema name or address..."
                className="w-full bg-transparent py-3.5 text-sm text-white outline-none placeholder-white/35"
              />
            </div>
            <button
              type="button"
              onClick={findNearbyCinemas}
              disabled={locating}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-white/75 transition-colors hover:border-blue-400/40 hover:text-white disabled:opacity-60"
            >
              {locating ? <Loader2 size={15} className="animate-spin" /> : <Navigation size={15} />}
              {currentLocation ? "Sorted by distance" : "Find cinemas near me"}
            </button>
          </div>
          {locationError && <p className="mt-2 text-xs text-amber-400">{locationError}</p>}

          {/* Province tabs */}
          <div className="mt-5 flex gap-2.5 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
            {provinces.map((p) => (
              <button
                key={p}
                onClick={() => setActiveProvince(p)}
                className="whitespace-nowrap rounded-full px-4 py-1.5 text-[13px] transition-all duration-200 hover:scale-105 cursor-pointer"
                style={
                  activeProvince === p
                    ? { background: "linear-gradient(135deg, #2563EB, #3B82F6)", color: "#FFFFFF", fontWeight: 700 }
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
        {loading ? (
          <div className="py-24 text-center text-white/40">Loading cinemas…</div>
        ) : filtered.length === 0 ? (
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
                  el.style.borderColor = "rgba(96,165,250,0.35)";
                  el.style.backgroundColor = "rgba(37,99,235,0.08)";
                  el.style.boxShadow = "0 20px 50px rgba(0,0,0,0.5)";
                }}
                onMouseLeave={(e) => {
                  const el = e.currentTarget as HTMLDivElement;
                  el.style.borderColor = "rgba(255,255,255,0.07)";
                  el.style.backgroundColor = "rgba(255,255,255,0.03)";
                  el.style.boxShadow = "none";
                }}
              >
                <button
                  type="button"
                  aria-label={favoriteIds.includes(cluster.clusterId) ? "Remove favorite" : "Add favorite"}
                  aria-pressed={favoriteIds.includes(cluster.clusterId)}
                  onClick={(event) => {
                    event.stopPropagation();
                    toggleFavorite(cluster.clusterId);
                  }}
                  className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-black/45 text-white/55 backdrop-blur transition-colors hover:text-blue-400"
                >
                  <Heart
                    size={16}
                    fill={favoriteIds.includes(cluster.clusterId) ? "currentColor" : "none"}
                    style={{ color: favoriteIds.includes(cluster.clusterId) ? "#60A5FA" : undefined }}
                  />
                </button>
                <div className="mb-5 flex items-start gap-4">
                  <div
                    className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl"
                    style={{ background: "rgba(37,99,235,0.14)", border: "1px solid rgba(96,165,250,0.24)" }}
                  >
                    <MapPin size={18} style={{ color: "#60A5FA" }} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-base font-bold text-white">{cluster.clusterName}</h3>
                    <p className="mt-0.5 text-[13px] text-white/40">{cluster.address}</p>
                    <p className="mt-0.5 text-[11px] uppercase tracking-wider text-blue-400/70">{cluster.province}</p>
                    {currentLocation && cluster.latitude != null && cluster.longitude != null && (
                      <p className="mt-1 flex items-center gap-1 text-[11px] text-emerald-400/80">
                        <Navigation size={10} />
                        {distanceInKm(currentLocation, {
                          latitude: cluster.latitude,
                          longitude: cluster.longitude,
                        }).toFixed(1)} km away
                      </p>
                    )}
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
                  style={{ color: "#60A5FA", fontSize: "0.82rem", fontWeight: 600, background: "none", border: "none", cursor: "pointer", padding: 0 }}
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
