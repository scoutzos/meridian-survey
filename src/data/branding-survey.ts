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
            "Logo A",
            "Logo B",
            "Logo C",
            "Logo D",
            "Logo E",
            "Logo F",
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
            "Palette 1",
            "Palette 2",
            "Palette 3",
            "Palette 4",
            "Palette 5",
            "Palette 6",
            "Palette 7",
            "Palette 8",
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
