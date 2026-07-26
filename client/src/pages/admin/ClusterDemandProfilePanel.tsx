import { useEffect, useState } from "react";
import { AlertTriangle, Check, Gauge, Loader2 } from "lucide-react";
import { movieApi, type ClusterDemandProfilePayload, type ClusterDemandProfileResponse, type DemandTier } from "../../api/movieApi";

const DEMAND_TIERS: DemandTier[] = ["HIGH", "NORMAL", "LOW"];

function emptyPayload(): ClusterDemandProfilePayload {
  return { demandTier: "NORMAL", demandScore: 50, minDailyShows: 1, maxDailyShowsPerMovie: 4 };
}

function fieldStyle() {
  return { background: "var(--bg-main)", borderColor: "var(--border-color)", color: "var(--text-main)", fontSize: "13px" } as const;
}

/** Admin-editable per-cluster demand inputs (AutoShowtimeCandidateSelector/Scorer reads these).
 *  Replaces the old V33 backfill migration - a cluster either gets a default profile the moment
 *  it's approved (CinemaClusterService#approveCluster) or an admin sets one explicitly here. */
export function ClusterDemandProfilePanel({ clusterId, canEdit }: { clusterId: number; canEdit: boolean }) {
  const [profile, setProfile] = useState<ClusterDemandProfileResponse | null>(null);
  const [notConfigured, setNotConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [payload, setPayload] = useState<ClusterDemandProfilePayload>(emptyPayload());
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setError(null);
    setNotConfigured(false);
    movieApi
      .getClusterDemandProfile(clusterId)
      .then((res) => {
        const result = res.result ?? null;
        setProfile(result);
        if (result) {
          setPayload({
            demandTier: result.demandTier,
            demandScore: result.demandScore,
            minDailyShows: result.minDailyShows,
            maxDailyShowsPerMovie: result.maxDailyShowsPerMovie,
          });
        }
      })
      .catch((err: any) => {
        if (err?.response?.status === 404) {
          setNotConfigured(true);
          setPayload(emptyPayload());
        } else {
          setError("Could not load this cluster's demand profile.");
        }
      })
      .finally(() => setLoading(false));
  };

  useEffect(load, [clusterId]);

  const save = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const res = await movieApi.updateClusterDemandProfile(clusterId, payload);
      setProfile(res.result ?? null);
      setNotConfigured(false);
      setEditing(false);
    } catch (err: any) {
      setSaveError(err?.response?.data?.message ?? "Could not save this cluster's demand profile.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <section className="rounded-2xl border p-4" style={{ borderColor: "var(--border-color)", background: "var(--bg-card)" }}>
        <p style={{ fontSize: "13px", color: "var(--text-sub)" }}>Loading demand profile…</p>
      </section>
    );
  }

  if (error) {
    return (
      <section className="rounded-2xl border p-4" style={{ borderColor: "var(--border-color)", background: "var(--bg-card)" }}>
        <p style={{ fontSize: "13px", color: "#e11d48" }}>{error}</p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border p-4" style={{ borderColor: "var(--border-color)", background: "var(--bg-card)" }}>
      <div className="flex items-center gap-2">
        <Gauge size={16} className="text-blue-600" />
        <h2 style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-main)" }}>Demand profile</h2>
      </div>
      <p className="mt-1 mb-3" style={{ fontSize: "11.5px", color: "var(--text-sub)" }}>
        Feeds the auto-showtime allocator: how many shows/day this cluster gets and how strongly it's weighted.
      </p>

      {notConfigured && !editing && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-dashed p-3" style={{ borderColor: "var(--border-color)" }}>
          <p style={{ fontSize: "12.5px", color: "var(--text-sub)" }}>Not configured yet — the allocator has no demand inputs for this cluster.</p>
          {canEdit && (
            <button type="button" onClick={() => { setPayload(emptyPayload()); setEditing(true); }}
              className="rounded-lg px-3 py-1.5 text-xs font-semibold text-white" style={{ background: "#2563eb" }}>
              Configure
            </button>
          )}
        </div>
      )}

      {!notConfigured && profile && !editing && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div>
            <p style={{ fontSize: "11px", color: "var(--text-sub)" }}>Tier</p>
            <p style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-main)" }}>{profile.demandTier}</p>
          </div>
          <div>
            <p style={{ fontSize: "11px", color: "var(--text-sub)" }}>Demand score</p>
            <p style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-main)" }}>{profile.demandScore}</p>
          </div>
          <div>
            <p style={{ fontSize: "11px", color: "var(--text-sub)" }}>Min shows/day</p>
            <p style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-main)" }}>{profile.minDailyShows}</p>
          </div>
          <div>
            <p style={{ fontSize: "11px", color: "var(--text-sub)" }}>Max/movie/day</p>
            <p style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-main)" }}>{profile.maxDailyShowsPerMovie}</p>
          </div>
          {canEdit && (
            <div className="col-span-2 sm:col-span-4">
              <button type="button" onClick={() => setEditing(true)}
                className="mt-1 rounded-lg border px-3 py-1.5 text-xs font-semibold" style={{ borderColor: "var(--border-color)", color: "var(--text-main)" }}>
                Edit
              </button>
            </div>
          )}
        </div>
      )}

      {editing && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div>
              <label className="mb-1 block" style={{ fontSize: "11px", color: "var(--text-sub)" }}>Tier</label>
              <select value={payload.demandTier} onChange={(e) => setPayload((p) => ({ ...p, demandTier: e.target.value as DemandTier }))}
                className="w-full rounded-lg border px-2.5 py-2 outline-none" style={fieldStyle()}>
                {DEMAND_TIERS.map((tier) => <option key={tier} value={tier}>{tier}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block" style={{ fontSize: "11px", color: "var(--text-sub)" }}>Demand score</label>
              <input type="number" step="0.01" min="0" value={payload.demandScore}
                onChange={(e) => setPayload((p) => ({ ...p, demandScore: Number(e.target.value) }))}
                className="w-full rounded-lg border px-2.5 py-2 outline-none" style={fieldStyle()} />
            </div>
            <div>
              <label className="mb-1 block" style={{ fontSize: "11px", color: "var(--text-sub)" }}>Min shows/day</label>
              <input type="number" min="0" value={payload.minDailyShows}
                onChange={(e) => setPayload((p) => ({ ...p, minDailyShows: Number(e.target.value) }))}
                className="w-full rounded-lg border px-2.5 py-2 outline-none" style={fieldStyle()} />
            </div>
            <div>
              <label className="mb-1 block" style={{ fontSize: "11px", color: "var(--text-sub)" }}>Max/movie/day</label>
              <input type="number" min="0" value={payload.maxDailyShowsPerMovie}
                onChange={(e) => setPayload((p) => ({ ...p, maxDailyShowsPerMovie: Number(e.target.value) }))}
                className="w-full rounded-lg border px-2.5 py-2 outline-none" style={fieldStyle()} />
            </div>
          </div>

          {saveError && (
            <p className="flex items-center gap-1.5 rounded-lg px-3 py-2" style={{ fontSize: "12px", color: "#dc2626", background: "rgba(220,38,38,.08)" }}>
              <AlertTriangle size={13} /> {saveError}
            </p>
          )}

          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => { setEditing(false); setSaveError(null); if (profile) setPayload({ demandTier: profile.demandTier, demandScore: profile.demandScore, minDailyShows: profile.minDailyShows, maxDailyShowsPerMovie: profile.maxDailyShowsPerMovie }); }}
              className="rounded-xl border px-4 py-2 text-xs font-semibold" style={{ borderColor: "var(--border-color)", color: "var(--text-sub)" }}>
              Cancel
            </button>
            <button type="button" onClick={save} disabled={saving}
              className="flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold text-white disabled:opacity-50" style={{ background: "#2563eb" }}>
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              Save
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
