export function Testimonials() {
  return (
    <section
      style={{
        background: "linear-gradient(180deg, rgba(5,9,20,0) 0%, rgba(255,255,255,0.022) 50%, rgba(5,9,20,0) 100%)",
        paddingTop: "80px",
        paddingBottom: "80px",
        borderTop: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      <div className="max-w-7xl mx-auto px-6">
        {/* Header */}
        <div className="text-center mb-12">
          <span style={{ color: "#FFD700", fontSize: "0.7rem", letterSpacing: "0.25em", fontWeight: 700, textTransform: "uppercase" }}>
            Loved By Movie Fans
          </span>
          <h2 style={{ color: "white", fontWeight: 800, fontSize: "clamp(1.6rem, 4vw, 2.5rem)", marginTop: "12px", lineHeight: 1.2 }}>
            What Our{" "}
            <span
              style={{ background: "linear-gradient(135deg, #FFD700, #FFA500)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}
            >
              Guests Say
            </span>
          </h2>
        </div>

        {/* Loading placeholders. Replace with API-backed reviews when the review service is connected. */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={index}
              className="relative flex min-h-[250px] flex-col rounded-2xl p-6 animate-pulse"
              style={{ border: "1px solid rgba(255,255,255,0.07)", backgroundColor: "rgba(255,255,255,0.03)" }}
            >
              <div className="mb-4 h-7 w-7 rounded bg-white/[0.10]" />
              <div className="mb-4 flex gap-1">
                {Array.from({ length: 5 }).map((_, starIndex) => (
                  <div key={starIndex} className="h-3 w-3 rounded-sm bg-white/[0.10]" />
                ))}
              </div>
              <div className="space-y-2">
                <div className="h-3 w-full rounded bg-white/[0.10]" />
                <div className="h-3 w-11/12 rounded bg-white/[0.08]" />
                <div className="h-3 w-3/4 rounded bg-white/[0.08]" />
              </div>
              <div className="mt-auto flex items-center gap-3 border-t border-white/[0.06] pt-4">
                <div className="h-9 w-9 rounded-full bg-white/[0.10]" />
                <div className="space-y-2">
                  <div className="h-3 w-24 rounded bg-white/[0.10]" />
                  <div className="h-2.5 w-16 rounded bg-white/[0.07]" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
