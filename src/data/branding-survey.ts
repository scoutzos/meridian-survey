import type { Survey } from "./surveys";

export const brandingSurvey: Survey = {
  id: "branding",
  title: "Branding Vote",
  description: "Choose the logo and color palette for Meridian Collective. Rank your top 3 for each category.",
  categories: [
    {
      id: "branding-logo",
      name: "Logo Vote",
      description: "Rank your top 3 logo options. 1st = 3pts, 2nd = 2pts, 3rd = 1pt.",
      questions: [
        {
          id: "branding-logo-rank",
          text: "Rank your top 3 logo options (1st = 3pts, 2nd = 2pts, 3rd = 1pt)",
          priority: "critical",
          options: [
            "01 The Meridian",
            "02 M° The Monogram",
            "03 The Coordinate",
            "04 The Seal",
            "05 The Wordmark",
            "06 The Globe",
          ],
        },
      ],
    },
    {
      id: "branding-palette",
      name: "Palette Vote",
      description: "Rank your top 3 color palettes. 1st = 3pts, 2nd = 2pts, 3rd = 1pt.",
      questions: [
        {
          id: "branding-palette-rank",
          text: "Rank your top 3 color palettes",
          priority: "critical",
          options: [
            "01 Obsidian & Brass",
            "02 Forest & Cognac",
            "03 Midnight & Oxblood",
            "04 Bone & Terracotta",
            "05 Graphite & Sage",
            "06A Imperial Gold",
            "06B Black & Burnished",
            "06C Navy & Gold",
          ],
        },
      ],
    },
    {
      id: "branding-comments",
      name: "Comments",
      questions: [
        {
          id: "branding-comments",
          text: "Any thoughts on branding direction?",
          priority: "critical",
          inputType: "text",
          placeholder: "Share your thoughts on the overall direction...",
        },
      ],
    },
  ],
};
