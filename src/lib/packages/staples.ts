export type PackageCategory =
  | "Ramp"
  | "Card Draw"
  | "Removal"
  | "Board Wipes"
  | "Counterspells"
  | "Tutors"
  | "Graveyard"
  | "Protection"
  | "Land Package";

export interface CardPackage {
  id: string;
  name: string;
  description: string;
  category: PackageCategory;
  /** MTG color symbols present in the package: W U B R G C */
  colors: string[];
  cardNames: string[];
  format: "commander" | "any";
}

export const CARD_PACKAGES: CardPackage[] = [
  // ── Ramp ────────────────────────────────────────────────────────────────────
  {
    id: "green-ramp",
    name: "Green Ramp Package",
    description: "Core green mana acceleration for Commander. Adds lands and ramp spells to hit your big plays faster.",
    category: "Ramp",
    colors: ["G"],
    format: "commander",
    cardNames: [
      "Sol Ring",
      "Arcane Signet",
      "Cultivate",
      "Kodama's Reach",
      "Farseek",
      "Rampant Growth",
      "Nature's Lore",
      "Three Visits",
      "Skyshroud Claim",
      "Explosive Vegetation",
    ],
  },
  {
    id: "artifact-ramp",
    name: "Artifact Ramp Package",
    description: "Colorless mana rocks — fits any Commander deck regardless of color identity.",
    category: "Ramp",
    colors: [],
    format: "commander",
    cardNames: [
      "Sol Ring",
      "Arcane Signet",
      "Commander's Sphere",
      "Mind Stone",
      "Hedron Archive",
      "Worn Powerstone",
      "Thought Vessel",
      "Wayfarer's Bauble",
    ],
  },

  // ── Card Draw ────────────────────────────────────────────────────────────────
  {
    id: "blue-draw",
    name: "Blue Card Draw Package",
    description: "Blue's best card advantage spells for Commander — cantrips, wheels, and instant-speed draw.",
    category: "Card Draw",
    colors: ["U"],
    format: "commander",
    cardNames: [
      "Rhystic Study",
      "Mystic Remora",
      "Brainstorm",
      "Ponder",
      "Preordain",
      "Windfall",
      "Archmage's Charm",
      "Fact or Fiction",
      "Drawn from Dreams",
      "Dig Through Time",
    ],
  },
  {
    id: "colorless-draw",
    name: "Colorless Draw Package",
    description: "Color-independent card draw for any deck.",
    category: "Card Draw",
    colors: [],
    format: "commander",
    cardNames: [
      "Skullclamp",
      "Sensei's Divining Top",
      "Scroll Rack",
      "Staff of Nin",
      "Well of Lost Dreams",
      "Lifecrafter's Bestiary",
      "Vanquisher's Banner",
    ],
  },

  // ── Removal ──────────────────────────────────────────────────────────────────
  {
    id: "white-removal",
    name: "White Removal Package",
    description: "Efficient white exile and enchantment-based removal — answers everything.",
    category: "Removal",
    colors: ["W"],
    format: "commander",
    cardNames: [
      "Swords to Plowshares",
      "Path to Exile",
      "Generous Gift",
      "Oblation",
      "Prismatic Ending",
      "Fateful Absence",
      "Sundering Growth",
      "Disenchant",
    ],
  },
  {
    id: "black-removal",
    name: "Black Removal Package",
    description: "Black's efficient spot removal and recursion-proof answers.",
    category: "Removal",
    colors: ["B"],
    format: "commander",
    cardNames: [
      "Doom Blade",
      "Go for the Throat",
      "Infernal Grasp",
      "Tragic Slip",
      "Deadly Rollick",
      "Snuff Out",
      "Feed the Swarm",
      "Baleful Mastery",
    ],
  },

  // ── Board Wipes ───────────────────────────────────────────────────────────────
  {
    id: "board-wipes",
    name: "Board Wipe Package",
    description: "Reset the battlefield — asymmetric and symmetric wraths for Commander.",
    category: "Board Wipes",
    colors: ["W", "B"],
    format: "commander",
    cardNames: [
      "Wrath of God",
      "Damnation",
      "Toxic Deluge",
      "Cyclonic Rift",
      "Farewell",
      "Vanquish the Horde",
      "Living Death",
      "Blasphemous Act",
    ],
  },

  // ── Counterspells ────────────────────────────────────────────────────────────
  {
    id: "blue-counters",
    name: "Counterspell Package",
    description: "The best blue counterspells for Commander — efficient and versatile.",
    category: "Counterspells",
    colors: ["U"],
    format: "commander",
    cardNames: [
      "Counterspell",
      "Swan Song",
      "Negate",
      "Arcane Denial",
      "Mana Drain",
      "Fierce Guardianship",
      "Pact of Negation",
      "Dispel",
      "Flusterstorm",
    ],
  },

  // ── Tutors ────────────────────────────────────────────────────────────────────
  {
    id: "black-tutors",
    name: "Black Tutor Package",
    description: "Find exactly what you need — black's best search effects.",
    category: "Tutors",
    colors: ["B"],
    format: "commander",
    cardNames: [
      "Demonic Tutor",
      "Vampiric Tutor",
      "Imperial Seal",
      "Diabolic Intent",
      "Beseech the Queen",
      "Scheming Symmetry",
      "Wishclaw Talisman",
    ],
  },

  // ── Graveyard ────────────────────────────────────────────────────────────────
  {
    id: "graveyard-hate",
    name: "Graveyard Hate Package",
    description: "Colorless hate pieces that shut down graveyard strategies.",
    category: "Graveyard",
    colors: [],
    format: "commander",
    cardNames: [
      "Grafdigger's Cage",
      "Rest in Peace",
      "Leyline of the Void",
      "Relic of Progenitus",
      "Tormod's Crypt",
      "Soul-Guide Lantern",
      "Nihil Spellbomb",
    ],
  },

  // ── Protection ───────────────────────────────────────────────────────────────
  {
    id: "white-protection",
    name: "White Protection Package",
    description: "Protect your commander and key pieces with white's best defensive tools.",
    category: "Protection",
    colors: ["W"],
    format: "commander",
    cardNames: [
      "Swiftfoot Boots",
      "Lightning Greaves",
      "Heroic Intervention",
      "Teferi's Protection",
      "Flawless Maneuver",
      "Akroma's Will",
      "Boros Charm",
    ],
  },

  // ── Land Package ─────────────────────────────────────────────────────────────
  {
    id: "utility-lands",
    name: "Utility Lands Package",
    description: "Format-staple utility lands for any Commander deck.",
    category: "Land Package",
    colors: [],
    format: "commander",
    cardNames: [
      "Command Tower",
      "Arcane Sanctum",
      "Reflecting Pool",
      "Exotic Orchard",
      "Mana Confluence",
      "City of Brass",
      "Ancient Tomb",
      "Reliquary Tower",
      "Bonders' Enclave",
      "War Room",
    ],
  },
];

export const PACKAGE_CATEGORIES = [
  "Ramp",
  "Card Draw",
  "Removal",
  "Board Wipes",
  "Counterspells",
  "Tutors",
  "Graveyard",
  "Protection",
  "Land Package",
] as PackageCategory[];

export const CATEGORY_COLORS: Record<PackageCategory, string> = {
  "Ramp":          "#22C55E",
  "Card Draw":     "#3B82F6",
  "Removal":       "#EF4444",
  "Board Wipes":   "#F97316",
  "Counterspells": "#8B5CF6",
  "Tutors":        "#A855F7",
  "Graveyard":     "#6B7280",
  "Protection":    "#F59E0B",
  "Land Package":  "#78716C",
};
