import type { Episode } from "./episode";
import type { EpisodesButton } from "./episodes-button";
import type { HeroSection } from "./hero-section";
import type { AboutSection } from "./about-section";
import type { FooterSection } from "./footer-section";
import type { SocialLink } from "./social-link";
import type { LiveData } from "./live";

// Result shape of the LandingPageContent query.
export type LandingPageContent = {
  heroSection: HeroSection | null;
  live: LiveData | null;
  episodes: Episode[];
  episodesButton: EpisodesButton | null;
  footerSection: FooterSection | null;
  socialLinks: SocialLink[];
  aboutSection: AboutSection | null;
};
