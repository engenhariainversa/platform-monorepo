import { gql } from "@apollo/client";

export const GET_DASHBOARD_STATS = gql`
  query GetDashboardStats {
    dashboardStats {
      users
      episodes
      lives
    }
  }
`;
