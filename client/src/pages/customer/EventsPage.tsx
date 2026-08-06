import { PartyPopper } from "lucide-react";

export default function EventsPage() {
  return (
    <div className="min-h-screen pt-16" style={{ backgroundColor: "#050505" }}>
      {/* Header */}
      <div className="border-b border-white/10 px-6 pb-8 pt-10">
        <div className="mx-auto max-w-7xl">
          <div className="mb-1 flex items-center gap-2.5">
            <PartyPopper size={20} style={{ color: "#FFD700" }} />
            <span style={{ color: "#FFD700", fontSize: "0.7rem", letterSpacing: "0.25em", fontWeight: 700, textTransform: "uppercase" }}>
              At The Cinema
            </span>
          </div>
          <h1 className="text-3xl font-extrabold text-white sm:text-4xl">Events</h1>
          <p className="mt-1.5 text-sm text-white/45">
            New CinePrime event announcements are being prepared.
          </p>
        </div>
      </div>

      {/* List */}
      <div className="mx-auto max-w-5xl px-6 py-10">
        <div className="flex flex-col gap-5" aria-busy="true" aria-label="Cinema events are being prepared">
          {Array.from({ length: 3 }, (_, index) => (
            <div
              key={index}
              className="relative flex flex-col overflow-hidden rounded-2xl sm:flex-row"
              style={{ border: "1px solid rgba(255,255,255,0.07)", backgroundColor: "rgba(255,255,255,0.03)" }}
            >
              <div className="relative h-48 w-full flex-shrink-0 overflow-hidden bg-white/[0.035] sm:h-auto sm:w-72">
                <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-blue-500/[0.08] via-white/[0.025] to-transparent" />
                <div className="absolute left-4 top-4 h-6 w-24 animate-pulse rounded-full bg-white/[0.08]" />
              </div>

              <div className="flex min-h-48 flex-1 flex-col justify-center gap-4 p-6">
                <div className="h-5 w-2/5 animate-pulse rounded-full bg-white/[0.1]" />
                <div className="h-3 w-3/5 animate-pulse rounded-full bg-white/[0.07]" />
                <div className="space-y-2">
                  <div className="h-3 w-full animate-pulse rounded-full bg-white/[0.055]" />
                  <div className="h-3 w-4/5 animate-pulse rounded-full bg-white/[0.055]" />
                </div>
                <div className="mt-1 flex gap-5">
                  <div className="h-3 w-24 animate-pulse rounded-full bg-white/[0.065]" />
                  <div className="h-3 w-20 animate-pulse rounded-full bg-white/[0.065]" />
                  <div className="h-3 w-28 animate-pulse rounded-full bg-white/[0.065]" />
                </div>
              </div>
            </div>
          ))}
        </div>
        <p className="mt-7 text-center text-sm text-white/40" role="status">
          Event schedules will appear here when they are published.
        </p>
      </div>
    </div>
  );
}
