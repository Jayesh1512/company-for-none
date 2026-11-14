import { lookup as dnsLookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import https from 'node:https';
import http from 'node:http';

export class RetrievalError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}

// Transport safety only. Research eligibility and limits are supplied by Rules.
export function isPublicAddress(address) {
  const ip = address.replace(/^\[|\]$/g, '').toLowerCase();
  if (isIP(ip) === 4) {
    const [a, b] = ip.split('.').map(Number);
    return !(a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) || (a === 192 && [0, 168].includes(b)) ||
      (a === 198 && [18, 19, 51].includes(b)) || (a === 203 && b === 0));
  }
  // Only globally routed IPv6 unicast. Reject mapped IPv4 and special ranges.
  if (isIP(ip) === 6) {
    const [first, second] = ip.split(':').map(part => Number.parseInt(part || '0', 16));
    return /^[23][0-9a-f]{0,3}:/.test(ip) && !(first === 0x2001 && (second < 0x200 || second === 0xdb8)) && first !== 0x2002 && first !== 0x3fff;
  }
  return false;
}

export async function resolvePublicUrl(input, { lookup = dnsLookup } = {}) {
  let url;
  try { url = new URL(input); } catch { throw new RetrievalError('UNSAFE_SOURCE', 'Source URL is invalid.'); }
  const hostname = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password ||
      (url.port && url.port !== (url.protocol === 'https:' ? '443' : '80')) ||
      hostname === 'localhost' || /\.(localhost|local|internal|home|lan|test|invalid)$/.test(hostname)) {
    throw new RetrievalError('UNSAFE_SOURCE', 'Only public HTTP(S) sources without credentials are supported.');
  }
  const addresses = isIP(hostname) ? [{ address: hostname, family: isIP(hostname) }] : await lookup(hostname, { all: true, verbatim: true });
  if (!addresses.length || addresses.some(({ address }) => !isPublicAddress(address))) {
    throw new RetrievalError('UNSAFE_SOURCE', 'Local, private, or reserved network destinations are blocked.');
  }
  url.hash = '';
  return { url, address: addresses[0] };
}

function positive(value, name, allowZero = false) {
  if (!Number.isSafeInteger(value) || value < (allowZero ? 0 : 1)) throw new RetrievalError('INVALID_SPEC', `Rules must supply ${name}.`);
  return value;
}

function readPinned({ url, address }, { maxBytes, timeoutMs, signal }) {
  return new Promise((resolve, reject) => {
    let bytes = 0;
    const client = url.protocol === 'https:' ? https : http;
    const req = client.get(url, {
      signal, agent: false, headers: { 'user-agent': 'ResearchShop/1.0 (bounded public-source research)', accept: 'text/html,text/plain,application/json', 'accept-encoding': 'identity' },
      // Pin the checked address: a second DNS resolution must not reach a private host.
      lookup: (_host, options, callback) => options.all ? callback(null, [address]) : callback(null, address.address, address.family),
    }, res => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode)) { res.destroy(); resolve({ redirect: res.headers.location }); return; }
      if (res.statusCode < 200 || res.statusCode >= 300) { res.destroy(); reject(new RetrievalError('SOURCE_HTTP_ERROR', `Source returned HTTP ${res.statusCode}.`)); return; }
      const contentType = String(res.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
      if (!['text/html', 'text/plain', 'application/json', 'application/xhtml+xml'].includes(contentType) || (res.headers['content-encoding'] && res.headers['content-encoding'] !== 'identity')) {
        res.destroy(); reject(new RetrievalError('UNSUPPORTED_SOURCE_TYPE', 'Source must be uncompressed public text.')); return;
      }
      const chunks = [];
      res.on('data', chunk => {
        bytes += chunk.length;
        if (bytes > maxBytes) { res.destroy(new RetrievalError('SOURCE_TOO_LARGE', 'Source exceeds the approved byte limit.')); return; }
        chunks.push(chunk);
      });
      res.on('error', reject);
      res.on('end', () => resolve({ body: Buffer.concat(chunks).toString('utf8'), contentType, bytes }));
    });
    req.on('error', reject);
    const timer = setTimeout(() => req.destroy(new RetrievalError('SOURCE_TIMEOUT', 'Source timed out.')), timeoutMs);
    timer.unref();
    req.on('close', () => clearTimeout(timer));
  });
}

export function sourceText(body, contentType) {
  if (contentType !== 'text/html' && contentType !== 'application/xhtml+xml') return body.trim();
  return body.replace(/<!--[\s\S]*?-->/g, ' ').replace(/<(script|style|noscript|template)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, ' ')
    .replace(/<[^>]*>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/&quot;/gi, '"').replace(/&#39;/gi, "'").replace(/\s+/g, ' ').trim();
}

export async function retrievePublicSource({ url, maxBytes, timeoutMs, maxRedirects, signal }, ports = {}) {
  positive(maxBytes, 'maxBytes'); positive(timeoutMs, 'timeoutMs'); positive(maxRedirects, 'maxRedirects', true);
  let next = url;
  const deadline = Date.now() + timeoutMs;
  const bounded = async promise => {
    let timer;
    try { return await Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new RetrievalError('SOURCE_TIMEOUT', 'Source timed out.')), Math.max(0, deadline - Date.now())); })]); }
    finally { clearTimeout(timer); }
  };
  for (let redirects = 0; redirects <= maxRedirects; redirects++) {
    const target = await bounded(resolvePublicUrl(next, ports));
    const result = await bounded((ports.read || readPinned)(target, { maxBytes, timeoutMs: Math.max(1, deadline - Date.now()), signal }));
    if (result.redirect !== undefined) {
      if (!result.redirect || redirects === maxRedirects) throw new RetrievalError('SOURCE_REDIRECT_LIMIT', 'Source redirect limit reached.');
      next = new URL(result.redirect, target.url).href;
      continue;
    }
    return { url: target.url.href, text: sourceText(result.body, result.contentType), bytes: result.bytes, contentType: result.contentType, mode: 'public-retrieval' };
  }
}
