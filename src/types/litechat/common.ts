export type Metadata = Record<string, any>;

// Base for DB items
export interface DbBase {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

export type Theme = "light" | "dark" | "system" | "TijuLight" | "TijuDark" | "custom" | "bubblegum" | "bubblegumDark" | "candyland" | "candylandDark" | "doom64" | "doom64Dark" | "luxury" | "luxuryDark" | "northernLights" | "northernLightsDark" | "retroArcade" | "retroArcadeDark" | "staryNight" | "staryNightDark" | "tangerine" | "tangerineDark";

export const THEME_OPTIONS: Theme[] = [
  "light",
  "dark",
  "system",
  "TijuLight",
  "TijuDark",
  "custom",
  "bubblegum",
  "bubblegumDark",
  "candyland",
  "candylandDark",
  "doom64",
  "doom64Dark",
  "luxury",
  "luxuryDark",
  "northernLights",
  "northernLightsDark",
  "retroArcade",
  "retroArcadeDark",
  "staryNight",
  "staryNightDark",
  "tangerine",
  "tangerineDark",
];
