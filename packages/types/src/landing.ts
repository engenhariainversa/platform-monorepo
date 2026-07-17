import type { Episode } from "./episode";
import type { EpisodesButton } from "./episodes-button";
import type { HeroSection } from "./hero-section";
import type { AboutSection } from "./about-section";
import type { LiveData } from "./live";

// Result shape of the LandingPageContent query.
export type LandingPageContent = {
  heroSection: HeroSection | null;
  live: LiveData | null;
  episodes: Episode[];
  episodesButton: EpisodesButton | null;
  aboutSection: AboutSection | null;
};
