import { Outlet } from "react-router-dom";
import { Navbar } from "../layouts/Navbar";
import { Footer } from "../layouts/Footer";
import { BookingFlowProvider } from "../context/BookingFlowContext";

export default function CustomerLayout() {
  return (
    <BookingFlowProvider>
      <div style={{ backgroundColor: "#050505", minHeight: "100vh", fontFamily: "'Inter', sans-serif" }}>
        <Navbar />
        <main>
          <Outlet />
        </main>
        <Footer />
      </div>
    </BookingFlowProvider>
  );
}