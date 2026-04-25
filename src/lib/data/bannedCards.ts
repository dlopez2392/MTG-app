// Banned & Restricted Lists by Format
// Last updated: 2026-04-25
// Sources: magic.wizards.com/en/banned-restricted-list, mtgcommander.net

export const BANNED_LISTS: Record<string, { banned: string[]; restricted?: string[] }> = {
  commander: {
    banned: [
      // Power Nine
      "Ancestral Recall", "Balance", "Biorhythm", "Black Lotus",
      // Fast mana / broken
      "Channel", "Chaos Orb", "Coalition Victory", "Dread Return",
      "Emrakul, the Aeons Torn", "Erayo, Soratami Ascendant",
      "Falling Star", "Fastbond", "Flash", "Gifts Ungiven",
      "Golos, Tireless Pilgrim", "Griselbrand",
      "Hullbreacher", "Iona, Shield of Emeria",
      "Karakas", "Leovold, Emissary of Trest",
      "Library of Alexandria", "Limited Resources",
      "Lutri, the Spellchaser",
      // Banned September 2024
      "Mana Crypt", "Jeweled Lotus", "Nadu, Winged Wisdom", "Dockside Extortionist",
      "Mox Emerald", "Mox Jet", "Mox Pearl", "Mox Ruby", "Mox Sapphire",
      "Panoptic Mirror", "Paradox Engine", "Primeval Titan",
      "Prophet of Kruphix", "Recurring Nightmare",
      "Rofellos, Llanowar Emissary",
      "Shahrazad", "Sundering Titan", "Sway of the Stars",
      "Sylvan Primordial", "Time Vault", "Time Walk",
      "Tinker", "Tolarian Academy", "Trade Secrets",
      "Upheaval", "Worldfire",
      "Yawgmoth's Bargain",
    ],
  },
  modern: {
    banned: [
      "Ancient Den", "Arcum's Astrolabe", "Birthing Pod",
      "Blazing Shoal", "Bridge from Below", "Chrome Mox",
      "Cloudpost", "Dark Depths", "Deathrite Shaman",
      "Dig Through Time", "Dread Return",
      "Eye of Ugin", "Faithless Looting", "Field of the Dead",
      "Fury",
      "Gitaxian Probe", "Glimpse of Nature",
      "Golgari Grave-Troll", "Great Furnace",
      "Green Sun's Zenith", "Hogaak, Arisen Necropolis",
      "Hypergenesis",
      "Krark-Clan Ironworks",
      "Lurrus of the Dream-Den",
      "Mental Misstep", "Mox Opal", "Mycosynth Lattice",
      "Mystic Sanctuary",
      "Nadu, Winged Wisdom",
      "Oko, Thief of Crowns", "Once Upon a Time",
      "Ponder", "Preordain", "Punishing Fire",
      "Rite of Flame",
      "Seat of the Synod", "Second Sunrise",
      "Seething Song", "Sensei's Divining Top",
      "Simian Spirit Guide", "Skullclamp",
      "Splinter Twin", "Summer Bloom",
      "Tibalt's Trickery", "Treasure Cruise",
      "Tree of Tales",
      "Umezawa's Jitte", "Uro, Titan of Nature's Wrath",
      "Vault of Whispers",
      "Violent Outburst",
      "Yorion, Sky Nomad",
    ],
  },
  pioneer: {
    banned: [
      "Balustrade Spy", "Bloodstained Mire",
      "Expressive Iteration",
      "Felidar Guardian", "Fetch lands",
      "Field of the Dead", "Flooded Strand",
      "Geological Appraiser",
      "Inverter of Truth",
      "Kethis, the Hidden Hand",
      "Leyline of Abundance", "Lurrus of the Dream-Den",
      "Nadu, Winged Wisdom",
      "Nexus of Fate",
      "Oko, Thief of Crowns", "Once Upon a Time",
      "Polluted Delta",
      "Smuggler's Copter", "Sorin, Imperious Bloodlord",
      "Undercity Informer", "Underworld Breach",
      "Uro, Titan of Nature's Wrath",
      "Veil of Summer",
      "Walking Ballista", "Wilderness Reclamation",
      "Windswept Heath", "Wooded Foothills",
    ],
  },
  standard: {
    banned: [
      "Nadu, Winged Wisdom",
    ],
  },
  legacy: {
    banned: [
      "Ancestral Recall", "Balance", "Bazaar of Baghdad",
      "Black Lotus", "Channel", "Chaos Orb",
      "Deathrite Shaman", "Dig Through Time",
      "Dreadhorde Arcanist",
      "Earthcraft", "Expressive Iteration",
      "Falling Star", "Fastbond", "Flash",
      "Frantic Search",
      "Gitaxian Probe", "Goblin Recruiter",
      "Gush",
      "Hermit Druid", "Hullbreacher",
      "Library of Alexandria", "Lurrus of the Dream-Den",
      "Mana Drain", "Mana Vault", "Memory Jar",
      "Mental Misstep", "Mind's Desire",
      "Mishra's Workshop", "Mox Diamond",
      "Mox Emerald", "Mox Jet", "Mox Pearl", "Mox Ruby", "Mox Sapphire",
      "Mystical Tutor",
      "Nadu, Winged Wisdom",
      "Necropotence",
      "Oath of Druids", "Oko, Thief of Crowns",
      "Ragavan, Nimble Pilferer",
      "Shahrazad", "Skullclamp", "Sol Ring",
      "Strip Mine",
      "Survival of the Fittest",
      "Time Vault", "Time Walk", "Timetwister",
      "Tinker", "Tolarian Academy", "Treasure Cruise",
      "Underworld Breach",
      "Windfall",
      "Wrenn and Six",
      "Yawgmoth's Bargain", "Yawgmoth's Will",
    ],
  },
  vintage: {
    banned: [
      "Chaos Orb", "Falling Star", "Shahrazad",
      "Lurrus of the Dream-Den",
    ],
    restricted: [
      "Ancestral Recall", "Balance", "Black Lotus",
      "Brainstorm", "Chalice of the Void", "Channel",
      "Demonic Tutor", "Dig Through Time",
      "Flash", "Gitaxian Probe",
      "Gush",
      "Imperial Seal",
      "Karn, the Great Creator",
      "Lion's Eye Diamond", "Lodestone Golem",
      "Lotus Petal",
      "Mana Crypt", "Mana Vault", "Memory Jar",
      "Mental Misstep", "Merchant Scroll",
      "Mind's Desire", "Monastery Mentor",
      "Mox Emerald", "Mox Jet", "Mox Pearl", "Mox Ruby", "Mox Sapphire",
      "Mystic Forge", "Mystical Tutor",
      "Narset, Parter of Veils", "Necropotence",
      "Ponder", "Preordain",
      "Sol Ring",
      "Thorn of Amethyst", "Time Vault", "Time Walk",
      "Timetwister", "Tinker", "Tolarian Academy",
      "Treasure Cruise", "Trinisphere",
      "Vampiric Tutor",
      "Wheel of Fortune",
      "Windfall",
      "Yawgmoth's Will",
    ],
  },
  pauper: {
    banned: [
      "Arcum's Astrolabe", "Atog",
      "Bonder's Ornament",
      "Chatterstorm", "Cloud of Faeries",
      "Cranial Plating",
      "Daze",
      "Empty the Warrens",
      "Fall from Favor", "Frantic Search",
      "Galvanic Relay", "Gitaxian Probe",
      "Grapeshot", "Gush",
      "High Tide", "Hymn to Tourach",
      "Invigorate",
      "Monastery Swiftspear", "Mystic Sanctuary",
      "Peregrine Drake", "Prophetic Prism",
      "Sinkhole",
      "Sojourner's Companion",
      "Temporal Fissure", "Treasure Cruise",
    ],
  },
  historic: {
    banned: [
      "Agent of Treachery",
      "Channel", "Counterspell",
      "Dark Ritual",
      "Demonic Tutor",
      "Field of the Dead", "Fires of Invention",
      "Legacy's Allure", "Lurrus of the Dream-Den",
      "Nadu, Winged Wisdom",
      "Natural Order", "Necropotence", "Nexus of Fate",
      "Oko, Thief of Crowns", "Once Upon a Time",
      "Ragavan, Nimble Pilferer",
      "Teferi, Time Raveler",
      "Tibalt's Trickery",
      "Uro, Titan of Nature's Wrath",
      "Veil of Summer",
      "Wilderness Reclamation", "Winota, Joiner of Forces",
    ],
  },
  explorer: {
    banned: [
      "Expressive Iteration",
      "Fable of the Mirror-Breaker",
      "Felidar Guardian", "Field of the Dead",
      "Geological Appraiser",
      "Kethis, the Hidden Hand",
      "Leyline of Abundance", "Lurrus of the Dream-Den",
      "Nadu, Winged Wisdom",
      "Nexus of Fate",
      "Oko, Thief of Crowns", "Once Upon a Time",
      "Smuggler's Copter", "Sorin, Imperious Bloodlord",
      "Tibalt's Trickery",
      "Uro, Titan of Nature's Wrath",
      "Veil of Summer",
      "Walking Ballista", "Wilderness Reclamation",
      "Winota, Joiner of Forces",
    ],
  },
  brawl: {
    banned: [
      "Drannith Magistrate",
      "Golos, Tireless Pilgrim",
      "Lutri, the Spellchaser",
      "Nadu, Winged Wisdom",
      "Oko, Thief of Crowns",
      "Pithing Needle",
      "Runed Halo",
      "Sorcerous Spyglass",
      "Tasha's Hideous Laughter",
    ],
  },
};

export function getBannedList(format: string): string[] {
  const key = format.toLowerCase().replace(/[^a-z]/g, "");
  return BANNED_LISTS[key]?.banned ?? [];
}

export function getRestrictedList(format: string): string[] {
  const key = format.toLowerCase().replace(/[^a-z]/g, "");
  return BANNED_LISTS[key]?.restricted ?? [];
}

export function formatBanListForPrompt(format: string): string {
  const key = format.toLowerCase().replace(/[^a-z]/g, "");
  const list = BANNED_LISTS[key];
  if (!list) return `No known banned list for "${format}".`;

  let text = `BANNED in ${format}:\n${list.banned.join(", ")}\n`;
  if (list.restricted && list.restricted.length > 0) {
    text += `\nRESTRICTED in ${format} (max 1 copy):\n${list.restricted.join(", ")}\n`;
  }
  return text;
}
