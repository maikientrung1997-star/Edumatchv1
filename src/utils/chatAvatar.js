/** Public uploaded avatars go through Laravel CORS; external/Google photos keep their original URL. */
export function resolveChatAvatarUrl(source, apiBaseUrl) {
  if (!source) return '';
  const value = String(source).trim();
  if (!value || /^(?:data:|blob:)/i.test(value)) return value;
  try {
    const base = new URL(`${apiBaseUrl.replace(/\/+$/, '')}/`, 'http://localhost');
    const image = new URL(value, base);
    const loopback = (host) => ['localhost', '127.0.0.1', '[::1]'].includes(host);
    const sameBackend = image.origin === base.origin || (loopback(image.hostname) && loopback(base.hostname) && image.port === base.port && image.protocol === base.protocol);
    const filename = image.pathname.match(/\/storage\/avatars\/([A-Za-z0-9][A-Za-z0-9._-]*\.(?:png|jpe?g|webp|gif))$/i)?.[1];
    if (!sameBackend || !filename) return value;
    const target = new URL(`media/avatars/${encodeURIComponent(filename)}`, base);
    target.search = image.search;
    return target.href;
  } catch { return value; }
}
