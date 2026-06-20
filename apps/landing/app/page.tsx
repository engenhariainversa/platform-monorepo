import { Navbar } from "../components/navbar";
import { Hero } from "../components/hero";
import { LiveSection } from "../components/live-section";
import { EpisodesSection } from "../components/episodes-section";
import { AboutSection } from "../components/about-section";
import { Footer } from "../components/footer";

export default function Page() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <LiveSection />
        <EpisodesSection />
        <AboutSection />
      </main>
      <Footer />
    </>
  );
}
