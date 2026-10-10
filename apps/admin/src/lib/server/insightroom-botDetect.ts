/**
 * Bot/Crawler Detection Utility
 * Detects search engine crawlers, AI assistants, and ad verification bots.
 */

const BOT_PATTERN = new RegExp([
  'googlebot',
  'google-inspectiontool',
  'bingbot',
  'slurp',
  'duckduckbot',
  'baiduspider',
  'yandexbot',
  'sogou',
  'exabot',
  'ia_archiver',
  'facebot',
  'facebookexternalhit',
  'twitterbot',
  'linkedinbot',
  'whatsapp',
  'telegrambot',
  'slackbot',
  'discordbot',
  'pinterestbot',
  'chatgpt-user',
  'gptbot',
  'oai-searchbot',
  'claudebot',
  'claude-web',
  'anthropic-ai',
  'perplexitybot',
  'cohere-ai',
  'meta-externalagent',
  'bytespider',
  'google-extended',
  'ccbot',
  'adsbot-google',
  'mediapartners-google',
  'google-adwords',
  'adsbot',
  'semrushbot',
  'ahrefsbot',
  'mj12bot',
  'dotbot',
  'rogerbot',
  'screaming frog',
  'sitebulb',
  'bot',
  'crawler',
  'spider',
  'curl',
  'wget',
  'python-requests',
  'postman'
].join('|'), 'i');

export function isBot(request: Request): boolean {
  const userAgent = request.headers.get('user-agent') || '';
  if (!userAgent) return false;
  return BOT_PATTERN.test(userAgent);
}
