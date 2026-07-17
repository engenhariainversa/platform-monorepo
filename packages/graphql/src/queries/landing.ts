import { gql } from "@apollo/client";

// Single document backing the whole landing page. Both LiveSection and
// EpisodesSection execute it, so Apollo serves them from one network request
// and keeps the two sections in sync from the same cache entries.
export const LANDING_PAGE_CONTENT = gql`
  query LandingPageContent {
    heroSection {
      id
      title
      subtitle
      buttonText
      buttonUrl
    }

    live {
      id
      label
      title
      description
      buttonText
      buttonTextBefore
      buttonUrl
      thumbnailUrl
      isLive
      isVisible
      viewersCount
      occursAt
      occursAtTimezone
    }

    episodes {
      id
      module
      title
      duration
      imageUrl
      order
    }

    episodesButton {
      id
      text
      url
    }

    aboutSection {
      id
      title
      body
      stat1Value
      stat1Label
      stat2Value
      stat2Label
    }
  }
`;
