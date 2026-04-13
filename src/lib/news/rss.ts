export interface NewsItem {
  id: string;
  title: string;
  description: string;
  url: string;
  imageUrl?: string;
  author?: string;
  publishedAt: string; // ISO
  feedKey: string;
  feedName: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function tagContent(xml: string, tag: string): string {
  // Handles CDATA and plain text, case-insensitive tag
  const re = new RegExp(
    `<${tag}(?:\\s[^>]*)?>\\s*(?:<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>|([\\s\\S]*?))<\\/${tag}>`,
    "i"
  );
  const m = xml.match(re);
  return ((m?.[1] ?? m?.[2]) || "").trim();
}

function attrValue(xml: string, tag: string, attr: string): string {
  // <tag ... attr="value" ...> or self-closing
  const re = new RegExp(`<${tag}(?=[^>]*\\s${attr}=)[^>]*\\s${attr}=["']([^"']*)["']`, "i");
  return xml.match(re)?.[1]?.trim() ?? "";
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractImage(itemXml: string, descHtml: string): string | undefined {
  // 1. media:content
  let img = attrValue(itemXml, "media:content", "url");
  if (img && /\.(jpe?g|png|webp|gif)/i.test(img)) return img;

  // 2. media:thumbnail
  img = attrValue(itemXml, "media:thumbnail", "url");
  if (img) return img;

  // 3. enclosure with image type
  const encRe = /<enclosure[^>]+>/i;
  const encTag = itemXml.match(encRe)?.[0] ?? "";
  if (encTag && /type=["']image/i.test(encTag)) {
    img = attrValue(encTag, "enclosure", "url");
    if (img) return img;
  }

  // 4. First <img src="..."> inside description HTML
  const imgTag = descHtml.match(/<img[^>]+src=["']([^"']+)["']/i);
  if (imgTag?.[1]) return imgTag[1];

  return undefined;
}

function parseDate(raw: string): string {
  if (!raw) return new Date().toISOString();
  try {
    return new Date(raw).toISOString();
  } catch {
    return new Date().toISOString();
  }
}

// ── Main parser ───────────────────────────────────────────────────────────────

export function parseRSS(xml: string, feedKey: string, feedName: string): NewsItem[] {
  const items: NewsItem[] = [];

  // Support both RSS <item> and Atom <entry>
  const blockRe = /(<item>[\s\S]*?<\/item>|<entry>[\s\S]*?<\/entry>)/gi;
  const blocks = [...xml.matchAll(blockRe)];

  for (const [block] of blocks) {
    const title = stripHtml(tagContent(block, "title"));
    if (!title) continue;

    // Link: RSS uses <link>url</link> OR Atom uses <link href="url"/>
    let url =
      tagContent(block, "link") ||
      attrValue(block, "link", "href");

    // Some RSS has <link> as self-closing with no content before next tag
    if (!url) {
      const m = block.match(/<link>([^<]+)<\/link>/i);
      url = m?.[1]?.trim() ?? "";
    }
    if (!url) continue;

    const descRaw =
      tagContent(block, "description") ||
      tagContent(block, "content:encoded") ||
      tagContent(block, "summary") ||
      tagContent(block, "content");

    const description = stripHtml(descRaw).slice(0, 200);

    const author =
      tagContent(block, "dc:creator") ||
      tagContent(block, "author") ||
      tagContent(block, "name") ||
      undefined;

    const pubDate =
      tagContent(block, "pubDate") ||
      tagContent(block, "published") ||
      tagContent(block, "updated") ||
      tagContent(block, "dc:date");

    const imageUrl = extractImage(block, descRaw);

    items.push({
      id: `${feedKey}-${url}`,
      title,
      description,
      url,
      imageUrl,
      author: author ? stripHtml(author) : undefined,
      publishedAt: parseDate(pubDate),
      feedKey,
      feedName,
    });
  }

  return items;
}
