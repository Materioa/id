/**
 * Resolves attribution details (name, display name, avatar) based on the inputs and request headers.
 */
export function resolveAttribution(
  inputs: {
    saved_by_name?: string;
    saved_by_display_name?: string;
    saved_by_avatar?: string;
    author_name?: string;
    author_avatar?: string;
  },
  headers?: Headers
): { name: string; displayName: string; avatar: string } {
  let name = inputs.saved_by_name || inputs.author_name || '';
  let displayName = inputs.saved_by_display_name || '';
  let avatar = inputs.saved_by_avatar || inputs.author_avatar || '';

  // If name is not specified, try to infer from User-Agent
  const userAgent = (headers?.get('user-agent') || '').toLowerCase();
  if (!name) {
    if (userAgent.includes('perplexity')) {
      name = 'perplexity';
    } else if (userAgent.includes('claude') || userAgent.includes('anthropic')) {
      name = 'claude';
    } else if (userAgent.includes('gpt') || userAgent.includes('openai')) {
      name = 'chatgpt';
    } else if (userAgent.includes('google') || userAgent.includes('gemini')) {
      name = 'gemini';
    } else {
      name = 'api';
    }
  }

  const trimmed = name.trim().toLowerCase();

  let resolvedName = trimmed;
  let resolvedDisplayName = displayName;
  let resolvedAvatar = avatar;

  if (trimmed.includes('claude') || trimmed.includes('anthropic')) {
    resolvedName = 'claude';
    resolvedDisplayName = resolvedDisplayName || 'Claude';
    resolvedAvatar = resolvedAvatar || 'https://www.google.com/s2/favicons?sz=128&domain=claude.ai';
  } else if (trimmed.includes('perplexity')) {
    resolvedName = 'perplexity';
    resolvedDisplayName = resolvedDisplayName || 'Perplexity';
    resolvedAvatar = resolvedAvatar || 'https://www.google.com/s2/favicons?sz=128&domain=perplexity.ai';
  } else if (trimmed.includes('chatgpt') || trimmed.includes('openai') || trimmed.includes('gpt')) {
    resolvedName = 'chatgpt';
    resolvedDisplayName = resolvedDisplayName || 'ChatGPT';
    resolvedAvatar = resolvedAvatar || 'https://www.google.com/s2/favicons?sz=128&domain=openai.com';
  } else if (trimmed.includes('gemini') || trimmed.includes('google')) {
    resolvedName = 'gemini';
    resolvedDisplayName = resolvedDisplayName || 'Gemini';
    resolvedAvatar = resolvedAvatar || 'https://www.google.com/s2/favicons?sz=128&domain=gemini.google.com';
  } else if (trimmed.includes('deepseek')) {
    resolvedName = 'deepseek';
    resolvedDisplayName = resolvedDisplayName || 'DeepSeek';
    resolvedAvatar = resolvedAvatar || 'https://www.google.com/s2/favicons?sz=128&domain=deepseek.com';
  } else {
    // Fallback for custom domains/clients
    resolvedDisplayName = resolvedDisplayName || name || 'API Client';
    if (!resolvedAvatar && trimmed.includes('.')) {
      resolvedAvatar = `https://www.google.com/s2/favicons?sz=128&domain=${trimmed}`;
    }
  }

  return {
    name: resolvedName,
    displayName: resolvedDisplayName,
    avatar: resolvedAvatar || '/assets/img/default-avatar.svg'
  };
}
