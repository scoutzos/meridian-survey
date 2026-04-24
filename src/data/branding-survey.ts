import type { Survey } from "./surveys";

export const brandingSurvey: Survey = {
  id: "branding",
  title: "Brand Identity",
  description: "Vote on the visual identity of Meridian Collective — rank your logo and color palette preferences.",
  categories: [
    {
      id: "brand-logo",
      name: "Logo",
      description: "Rank the logo options from most to least preferred. Click each logo in order of preference — #1 is your top choice.",
      questions: [
        {
          id: "brand-logo-rank",
          text: "Rank the logo options in order of preference",
          context: "Click each option in the order you prefer it — your first click is your top choice. Click a ranked option again to remove it from your ranking.",
          priority: "critical",
          ranked: true,
          options: [
            "01 The Meridian",
            "02 M° The Monogram", 
            "03 The Coordinate",
            "04 The Seal",
            "05 The Wordmark",
            "06 The Globe",
            "07 The Meridian Collective",
          ],
        },
        {
          id: "brand-logo-notes",
          text: "Any notes on your logo preferences? What draws you to your top choice, or what doesn't work about your least favorite?",
          priority: "important",
        },
      ],
    },
    {
      id: "brand-palette",
      name: "Color Palette",
      description: "Rank the color palette options from most to least preferred.",
      questions: [
        {
          id: "brand-palette-rank",
          text: "Rank the color palettes in order of preference",
          context: "Click each palette in the order you prefer it — your first click is your top choice. Click a ranked option again to remove it from your ranking.",
          priority: "critical",
          ranked: true,
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
        {
          id: "brand-palette-notes",
          text: "Any notes on your palette preferences? What mood or feeling should the brand convey?",
          priority: "important",
        },
      ],
    },
  ],
};
