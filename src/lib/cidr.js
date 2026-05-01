'use strict';

const MAX_LIST_ENTRIES = 50;

function parseCidr(input) {
  if (typeof input !== 'string') return null;
  const trimmed = input.trim();
  if (!trimmed) return null;
  const [ipPart, maskPart] = trimmed.split('/');
  const blocks = ipPart.split('.');
  if (blocks.length !== 4) return null;
  let ipInt = 0;
  for (const b of blocks) {
    const n = parseInt(b, 10);
    if (Number.isNaN(n) || n < 0 || n > 255 || String(n) !== b) return null;
    // eslint-disable-next-line no-bitwise
    ipInt = ((ipInt << 8) | n) >>> 0;
  }
  let mask = 32;
  if (maskPart !== undefined) {
    mask = parseInt(maskPart, 10);
    if (Number.isNaN(mask) || mask < 0 || mask > 32 || String(mask) !== maskPart) return null;
  }
  // eslint-disable-next-line no-bitwise
  const maskInt = mask === 0 ? 0 : ((0xffffffff << (32 - mask)) >>> 0);
  // eslint-disable-next-line no-bitwise
  const networkInt = (ipInt & maskInt) >>> 0;
  return {
    ipInt, networkInt, maskInt, mask,
  };
}

function ipv4ToInt(input) {
  const m = parseCidr(input);
  return m ? m.ipInt : null;
}

function normalizeCidrList(input, max = MAX_LIST_ENTRIES) {
  if (!Array.isArray(input)) return [];
  const seen = new Set();
  const result = [];
  for (const entry of input) {
    const parsed = parseCidr(entry);
    if (!parsed) continue;
    // eslint-disable-next-line no-bitwise
    const a = (parsed.networkInt >>> 24) & 0xff;
    // eslint-disable-next-line no-bitwise
    const b = (parsed.networkInt >>> 16) & 0xff;
    // eslint-disable-next-line no-bitwise
    const c = (parsed.networkInt >>> 8) & 0xff;
    // eslint-disable-next-line no-bitwise
    const d = parsed.networkInt & 0xff;
    const canonical = `${a}.${b}.${c}.${d}/${parsed.mask}`;
    if (seen.has(canonical)) continue;
    seen.add(canonical);
    result.push(canonical);
    if (result.length >= max) break;
  }
  return result;
}

function ipMatchesCidrList(ip, cidrList) {
  if (!cidrList || cidrList.length === 0) return false;
  const epInt = ipv4ToInt(ip);
  if (epInt === null) return false;
  for (const cidr of cidrList) {
    const m = parseCidr(cidr);
    if (!m) continue;
    // eslint-disable-next-line no-bitwise
    if (((epInt & m.maskInt) >>> 0) === m.networkInt) return true;
  }
  return false;
}

// Same as ipMatchesCidrList but for the "endpoint" form ("ip:port") used by
// `wg show wg0 dump` and treats empty input / IPv6 / unparseable as a match
// (fail-open). This preserves the existing per-peer source-IP behaviour.
function endpointMatchesAllowList(endpoint, allowedSourceIps) {
  if (!allowedSourceIps || allowedSourceIps.length === 0) return true;
  if (!endpoint) return true;
  const ip = String(endpoint).split(':')[0];
  const epInt = ipv4ToInt(ip);
  if (epInt === null) return true; // IPv6 / unparseable — fail open
  for (const cidr of allowedSourceIps) {
    const m = parseCidr(cidr);
    if (!m) continue;
    // eslint-disable-next-line no-bitwise
    if (((epInt & m.maskInt) >>> 0) === m.networkInt) return true;
  }
  return false;
}

module.exports = {
  parseCidr,
  ipv4ToInt,
  normalizeCidrList,
  ipMatchesCidrList,
  endpointMatchesAllowList,
};
