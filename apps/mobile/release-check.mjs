// Only accept releases and assets from the official repository. Android still
// verifies the signing certificate and asks the user to approve installation.
export function parseAndroidRelease(value, currentCode) {
  if (!value || typeof value !== 'object' || value.draft !== false || value.prerelease !== false) return null;
  const match = /^android-v([1-9]\d*)$/.exec(value.tag_name || '');
  const code = match ? Number(match[1]) : NaN;
  if (!Number.isSafeInteger(code) || !Number.isSafeInteger(currentCode) || code <= currentCode) return null;
  const releaseUrl = `https://github.com/halluyapp/Anonymous-/releases/tag/android-v${code}`;
  if (value.html_url !== releaseUrl || !Array.isArray(value.assets)) return null;
  const download = `https://github.com/halluyapp/Anonymous-/releases/download/android-v${code}/after-dark.apk`;
  if (!value.assets.some(asset => asset?.name === 'after-dark.apk' && asset?.browser_download_url === download && asset?.state === 'uploaded')) return null;
  return { code, releaseUrl };
}
