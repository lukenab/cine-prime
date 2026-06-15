import { HeroSection } from "../../components/shared/HeroSection";
import { SearchBar } from "../../components/shared/SearchBar";
import { NowShowing } from "../../components/shared/NowShowing";
import { ExperienceBanner } from "../../components/shared/ExperienceBanner";
import { ComingSoon } from "../../components/shared/ComingSoon";

export default function HomePage() {
  return (
    <>
      <HeroSection />
      <SearchBar />
      <NowShowing />
      <ExperienceBanner />
      <ComingSoon />
    </>
  );
}