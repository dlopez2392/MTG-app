export interface FeedDef {
  key: string;
  name: string;
  url: string;
  color: string;
  initials: string;
}

export const FEEDS: FeedDef[] = [
  {
    key: "wizards",
    name: "Magic: The Gathering",
    url: "https://magic.wizards.com/en/rss/news",
    color: "#A855F7",
    initials: "WotC",
  },
  {
    key: "tcgplayer",
    name: "TCGplayer",
    url: "https://infinite.tcgplayer.com/rss",
    color: "#3B82F6",
    initials: "TCG",
  },
  {
    key: "edhrec",
    name: "EDHREC",
    url: "https://edhrec.com/articles/feed/",
    color: "#10B981",
    initials: "EDH",
  },
  {
    key: "mtggoldfish",
    name: "MTGGoldfish",
    url: "https://www.mtggoldfish.com/news/rss",
    color: "#F59E0B",
    initials: "GF",
  },
  {
    key: "arenazone",
    name: "MTG Arena Zone",
    url: "https://mtgazone.com/feed/",
    color: "#EC4899",
    initials: "AZ",
  },
  {
    key: "hipsters",
    name: "Hipsters of the Coast",
    url: "https://www.hipstersofthecoast.com/feed/",
    color: "#06B6D4",
    initials: "HotC",
  },
  {
    key: "starcitygames",
    name: "Star City Games",
    url: "https://articles.starcitygames.com/feed/",
    color: "#EF4444",
    initials: "SCG",
  },
  {
    key: "channelfireball",
    name: "ChannelFireball",
    url: "https://channelfireball.com/feed/",
    color: "#F97316",
    initials: "CF",
  },
];

export const DEFAULT_ENABLED = new Set(["wizards", "tcgplayer", "edhrec", "mtggoldfish", "arenazone", "hipsters"]);
