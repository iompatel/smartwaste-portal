export function canonicalRedirectUrl(
  currentUrl: string,
  renderHostname: string,
  canonicalOrigin: string,
) {
  try {
    const current = new URL(currentUrl);
    const canonical = new URL(canonicalOrigin);
    if (current.hostname !== renderHostname || canonical.protocol !== 'https:') {
      return null;
    }
    return new URL(`${current.pathname}${current.search}${current.hash}`, canonical).toString();
  } catch {
    return null;
  }
}

export function redirectFromRenderOrigin(renderHostname: string, canonicalOrigin: string) {
  const target = canonicalRedirectUrl(window.location.href, renderHostname, canonicalOrigin);
  if (!target) return false;
  window.location.replace(target);
  return true;
}
