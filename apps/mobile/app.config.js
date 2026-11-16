const fs = require('fs');
const { expo } = require('./app.json');
// A signed update service must be configured at build time. Never enable an
// untrusted, unsigned update feed just to make the toggle appear active.
const url = process.env.AFTER_DARK_UPDATES_URL;
const certificate = process.env.AFTER_DARK_UPDATES_CERTIFICATE;
if (Boolean(url) !== Boolean(certificate)) throw new Error('Set both AFTER_DARK_UPDATES_URL and AFTER_DARK_UPDATES_CERTIFICATE, or neither.');
if (url && (new URL(url).protocol !== 'https:' || !fs.existsSync(certificate))) throw new Error('Updates require an HTTPS URL and an existing signing certificate.');
module.exports = { expo: { ...expo,
  runtimeVersion: { policy: 'fingerprint' },
  updates: url ? { enabled:true, url, checkAutomatically:'ON_LOAD', fallbackToCacheTimeout:0, codeSigningCertificate:certificate, codeSigningMetadata:{keyid:'main',alg:'rsa-v1_5-sha256'} } : { enabled:false }
} };
