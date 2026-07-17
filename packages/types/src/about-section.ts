// "A Escola do Futuro" about section on the landing. Singleton, edited from the
// "About Section" content CMS page. `body` is plain text; blank lines separate
// paragraphs when rendered. The two stats are a fixed pair (value + label each).
export type AboutSection = {
  id: string;
  title: string;
  body: string;
  stat1Value: string;
  stat1Label: string;
  stat2Value: string;
  stat2Label: string;
};

export type UpsertAboutSectionInput = {
  title: string;
  body: string;
  stat1Value: string;
  stat1Label: string;
  stat2Value: string;
  stat2Label: string;
};
