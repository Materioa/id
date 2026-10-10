/**
 * Optimizes a Cloudinary image URL by appending resizing and quality transformations.
 * If the URL is not a Cloudinary URL, it is returned as-is.
 * 
 * @param {string} url - The original image URL
 * @param {number} width - The desired image width
 * @returns {string} The optimized image URL
 */
export function optimizeCloudinaryUrl(url, width = 800) {
  if (!url || typeof url !== 'string') return url;
  if (url.includes('res.cloudinary.com')) {
    // Check if it already has transformations (avoid duplicate/broken URLs)
    if (url.includes('/image/upload/w_') || url.includes('/image/upload/q_') || url.includes('/image/upload/f_')) {
      return url;
    }
    return url.replace('/image/upload/', `/image/upload/w_${width},f_auto,q_auto/`);
  }
  return url;
}

/**
 * Since the user's Supabase project has image optimization disabled,
 * this function simply returns the original URL as-is.
 * 
 * @param {any} url - The original image URL
 * @param {number} [width] - The desired image width
 * @returns {any} The original image URL
 */
export function optimizeSupabaseUrl(url, width = 60) {
  // Since the user's Supabase project has image optimization disabled,
  // we return the original URL as-is.
  return url;
}
