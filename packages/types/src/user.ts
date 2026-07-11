import type { Role } from "./role";

export type User = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  username: string;
  role: Role;
  // Only present in the users listing selection set.
  createdAt?: string;
};

/** Returned by the `login` / `setupAdmin` mutations. */
export type AuthPayload = {
  token: string;
  user: User;
};
