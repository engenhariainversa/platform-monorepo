// Footer of the landing page. Singleton, edited from the "Footer" content CMS
// page. Carries the visibility switches for the footer blocks whose content is
// not CMS-managed elsewhere.
export type FooterSection = {
  id: string;
  newsletterEnabled: boolean;
  socialLinksEnabled: boolean;
};

export type UpsertFooterSectionInput = {
  newsletterEnabled: boolean;
  socialLinksEnabled: boolean;
};
