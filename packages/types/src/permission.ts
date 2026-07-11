export type ResourcePermissions = {
  resource: string;
  create: boolean;
  read: boolean;
  update: boolean;
  delete: boolean;
};

export type PublicResource = {
  id: string;
  resource: string;
};
