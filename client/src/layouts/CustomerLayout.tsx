import { Outlet } from "react-router-dom";
import { Navbar } from "../layouts/Navbar";
import { Footer } from "../layouts/Footer";
import { BookingFlowProvider } from "../context/BookingFlowContext";

// The single cosmic backdrop for every customer-facing page. Values are
// deliberately identical to the ones ShowtimePage/SeatBookingPage set locally,
// so the whole customer journey reads as one continuous space instead of each
// page inventing its own shade of dark.
const COSMIC_WASH =
  "radial-gradient(ellipse 80% 50% at 15% -10%, rgba(37,99,235,.16), transparent 60%), " +
  "radial-gradient(ellipse 60% 40% at 100% 0%, rgba(56,189,248,.14), transparent 55%)";

export default function CustomerLayout() {
  return (
    <BookingFlowProvider>
      <div
        style={{
          position: "relative",
          backgroundColor: "#050914",
          minHeight: "100vh",
          fontFamily: "'Inter', sans-serif",
        }}
      >
        {/* Both backdrop layers are `fixed`, not painted onto the scrolling
            container. On a page as tall as the homepage a scrolling gradient
            would show its glow only at the very top and leave everything below
            flat; anchoring to the viewport keeps the wash and the starfield
            present the whole way down. Kept out of the flow behind a z-10
            content wrapper rather than using negative z-index, which behaves
            inconsistently once an ancestor forms a stacking context. */}
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 z-0"
          style={{ background: COSMIC_WASH }}
        />
        <div aria-hidden="true" className="cp-stars pointer-events-none fixed inset-0 z-0" />

        <div className="relative z-10">
          <Navbar />
          <main>
            <Outlet />
          </main>
          <Footer />
        </div>
      </div>
    </BookingFlowProvider>
  );
}
