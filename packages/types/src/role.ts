export type Role = {
  id: string;
  name: string;
  label: string;
  // The following are only present in selection sets that request them.
  description?: string | null;
  isSystem?: boolean;
  isAdmin?: boolean;
  userCount?: number;
};
