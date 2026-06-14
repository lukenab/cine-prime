import { Outlet } from "react-router-dom";
import { Navbar } from "../layouts/Navbar";
import { Footer } from "../layouts/Footer";

export default function CustomerLayout() {
  return (
    <div style={{ backgroundColor: "#050505", minHeight: "100vh", fontFamily: "'Inter', sans-serif" }}>
      <Navbar />
      <main>
        <Outlet /> 
      </main>
      <Footer />
    </div>
  );
}