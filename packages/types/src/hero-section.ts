// Hero section at the top of the landing page. Singleton, edited from the
// "Hero Section" content CMS page.
export type HeroSection = {
  id: string;
  title: string;
  subtitle: string;
  buttonText: string;
  buttonUrl: string;
};

export type UpsertHeroSectionInput = {
  title: string;
  subtitle: string;
  buttonText: string;
  buttonUrl: string;
};
