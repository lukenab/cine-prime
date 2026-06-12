import { Navbar } from "../Navbar";
import { HeroSection } from "../HeroSection";
import { SearchBar } from "../SearchBar";
import { NowShowing } from "../NowShowing";
import { ComingSoon } from "../ComingSoon";
import { ExperienceBanner } from "../ExperienceBanner";
import { Footer } from "../Footer";

function HomePage() {
  return (
    <div style={{ backgroundColor: "#050505", minHeight: "100vh", fontFamily: "'Inter', 'Helvetica Neue', sans-serif" }}>
      <Navbar />
      <HeroSection />
      <SearchBar />
      <NowShowing />
      <ExperienceBanner />
      <ComingSoon />
      <Footer />
    </div>
  );
}

export default HomePage;
