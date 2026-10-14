/**
 * Post SEO Generator
 * Generates best-practice SEO metadata extracted directly from post content
 * when the post is public and not hidden, draft, private, or unlisted.
 */

export interface PostSeoInput {
  title: string;
  slug?: string;
  content: string;
  category?: string;
  categories?: string[];
  excerpt?: string;
  image?: string;
  author?: string;
  scope?: 'room' | 'exodus';
  docType?: string;
  url?: string;
  draft?: boolean;
  hidden?: boolean;
  visibility?: string;
  metadata?: Record<string, any>;
}

export function isPostPublicAndIndexable(input: {
  draft?: boolean;
  hidden?: boolean;
  visibility?: string;
  metadata?: Record<string, any>;
}): boolean {
  const meta = input.metadata || {};
  const isDraft = Boolean(input.draft ?? meta.draft);
  const isHidden = Boolean(input.hidden ?? meta.hidden);
  const vis = String(input.visibility ?? meta.visibility ?? 'public').toLowerCase();

  if (isDraft || isHidden) return false;
  if (vis === 'private' || vis === 'unlisted' || vis === 'draft') return false;
  return true;
}

/**
 * Extracts clean, human-readable plain text from markdown or HTML content
 */
export function extractPlainTextFromMarkdown(content: string): string {
  if (!content || typeof content !== 'string') return '';

  let text = content;
  // Remove YAML frontmatter if present
  text = text.replace(/^---[\s\S]*?---\s*/, '');
  // Remove code blocks
  text = text.replace(/```[\s\S]*?```/g, ' ');
  // Remove inline code
  text = text.replace(/`([^`]+)`/g, '$1');
  // Remove HTML tags
  text = text.replace(/<[^>]+>/g, ' ');
  // Remove images ![alt](url)
  text = text.replace(/!\[.*?\]\(.*?\)/g, ' ');
  // Remove video shortcodes [video:url]
  text = text.replace(/\[video:.*?\]/g, ' ');
  // Replace links [text](url) with just text
  text = text.replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1');
  // Remove markdown headers
  text = text.replace(/^#{1,6}\s+/gm, '');
  // Remove blockquotes, horizontal rules, list bullets
  text = text.replace(/^>\s*/gm, '');
  text = text.replace(/^[-*_]{3,}\s*$/gm, '');
  text = text.replace(/^[\s*+-]\s+/gm, '');
  text = text.replace(/^\d+\.\s+/gm, '');
  // Remove bold / italic markers
  text = text.replace(/[*_]{1,3}([^*_]+)[*_]{1,3}/g, '$1');
  // Collapse whitespace
  text = text.replace(/\s+/g, ' ').trim();

  return text;
}

/**
 * Generates an optimal meta description (~150-160 characters) from content text
 */
export function generateMetaDescription(content: string, fallbackExcerpt?: string): string {
  if (fallbackExcerpt && fallbackExcerpt.trim().length >= 20) {
    const cleanExcerpt = extractPlainTextFromMarkdown(fallbackExcerpt);
    if (cleanExcerpt.length <= 165) return cleanExcerpt;
    return truncateAtWord(cleanExcerpt, 160);
  }

  const plain = extractPlainTextFromMarkdown(content);
  if (!plain) return '';

  return truncateAtWord(plain, 160);
}

function truncateAtWord(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  const sub = str.substring(0, maxLength);
  const lastSpace = sub.lastIndexOf(' ');
  if (lastSpace > maxLength * 0.7) {
    return sub.substring(0, lastSpace) + '...';
  }
  return sub + '...';
}

const STOPWORDS = new Set([
  'this', 'that', 'with', 'from', 'your', 'have', 'more', 'about', 'will', 'what',
  'when', 'where', 'which', 'their', 'there', 'they', 'them', 'these', 'those', 'been',
  'were', 'being', 'also', 'some', 'than', 'then', 'into', 'just', 'only', 'very',
  'post', 'user', 'materio', 'using', 'would', 'could', 'should'
]);

/**
 * Extracts relevant SEO keywords from title, categories, and content
 */
export function extractKeywords(input: {
  title: string;
  category?: string;
  categories?: string[];
  content: string;
  existingKeywords?: string[] | string;
}): string[] {
  const set = new Set<string>();

  if (Array.isArray(input.existingKeywords)) {
    input.existingKeywords.forEach((k) => k && set.add(k.trim().toLowerCase()));
  } else if (typeof input.existingKeywords === 'string' && input.existingKeywords.trim()) {
    input.existingKeywords.split(',').forEach((k) => k && set.add(k.trim().toLowerCase()));
  }

  if (input.category && input.category.trim()) set.add(input.category.trim().toLowerCase());
  if (Array.isArray(input.categories)) {
    input.categories.forEach((c) => c && set.add(c.trim().toLowerCase()));
  }

  // Extract from title
  const titleWords = (input.title || '')
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .split(/\s+/)
    .filter((w) => w.length > 3 && !STOPWORDS.has(w));

  titleWords.forEach((w) => set.add(w));

  // Extract top heading topics from content
  const headingMatches = (input.content || '').match(/^#{1,3}\s+(.+)$/gm);
  if (headingMatches) {
    for (const h of headingMatches) {
      const headingText = h.replace(/^#{1,3}\s+/, '').trim().toLowerCase();
      const words = headingText
        .replace(/[^\w\s-]/g, '')
        .split(/\s+/)
        .filter((w) => w.length > 3 && !STOPWORDS.has(w));
      words.forEach((w) => set.add(w));
      if (set.size >= 12) break;
    }
  }

  return Array.from(set).slice(0, 12);
}

/**
 * Builds the full SEO payload for a post
 */
export function generatePostSeo(input: PostSeoInput): {
  seo: Record<string, any>;
  excerpt: string;
  metadataPatch: Record<string, any>;
} {
  const isPublic = isPostPublicAndIndexable(input);
  const metadata = input.metadata || {};

  // If hidden, draft, private, or unlisted: protect with noindex
  if (!isPublic) {
    const noindexRobots = 'noindex, nofollow';
    return {
      seo: {
        indexable: false,
        robots: noindexRobots,
        reason: 'Post is marked as draft, hidden, private, or unlisted'
      },
      excerpt: input.excerpt || metadata.excerpt || '',
      metadataPatch: {
        robots: noindexRobots,
        seo_robots: noindexRobots,
        googlebot: noindexRobots
      }
    };
  }

  // Generate content-derived SEO
  const derivedDescription = generateMetaDescription(input.content, input.excerpt || metadata.excerpt);
  const excerpt = input.excerpt || metadata.excerpt || derivedDescription;

  const pageTitle = input.title ? `${input.title} — Materio` : 'Materio';
  const cleanImage = input.image || metadata.image || metadata.cover || '';

  const keywords = extractKeywords({
    title: input.title,
    category: input.category,
    categories: input.categories,
    content: input.content,
    existingKeywords: metadata.keywords
  });

  const baseUrl = input.scope === 'exodus' ? 'https://getmaterio.app' : 'https://room.getmaterio.app';
  const canonicalUrl = input.url
    ? input.url.startsWith('http')
      ? input.url
      : `${baseUrl}${input.url.startsWith('/') ? '' : '/'}${input.url}`
    : undefined;

  const robots = 'index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1';

  const seoData = {
    indexable: true,
    title: pageTitle,
    description: derivedDescription,
    excerpt,
    keywords,
    robots,
    canonical: canonicalUrl,
    og: {
      title: input.title,
      description: derivedDescription,
      image: cleanImage,
      type: 'article',
      url: canonicalUrl
    },
    twitter: {
      card: cleanImage ? 'summary_large_image' : 'summary',
      title: input.title,
      description: derivedDescription,
      image: cleanImage
    },
    article: {
      publishedTime: input.metadata?.date || new Date().toISOString(),
      author: input.author || metadata.author || 'Materio',
      section: input.category || metadata.category || 'General',
      tags: keywords
    }
  };

  const metadataPatch: Record<string, any> = {
    seo: seoData,
    seo_title: pageTitle,
    seo_description: derivedDescription,
    description: derivedDescription,
    keywords: keywords.join(', '),
    keywords_list: keywords,
    robots,
    googlebot: robots,
    og_title: input.title,
    og_description: derivedDescription,
    og_type: 'article',
    twitter_card: cleanImage ? 'summary_large_image' : 'summary',
    twitter_title: input.title,
    twitter_description: derivedDescription,
    ...(cleanImage ? { og_image: cleanImage, twitter_image: cleanImage } : {}),
    ...(canonicalUrl ? { canonical: canonicalUrl } : {})
  };

  return {
    seo: seoData,
    excerpt,
    metadataPatch
  };
}
