// CTA rendered under the episodes list on the landing ("Ver todos episódios").
// Singleton, edited from the episodes CMS page.
export type EpisodesButton = {
  id: string;
  text: string;
  url: string;
};

export type UpsertEpisodesButtonInput = {
  text: string;
  url: string;
};
