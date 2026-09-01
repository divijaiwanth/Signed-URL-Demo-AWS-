import crypto from 'node:crypto';

function sha256Hex(data) {
  return crypto.createHash('sha256').update(data, 'utf8').digest('hex');
}

function hmac(key, data) {
  return crypto.createHmac('sha256', key).update(data, 'utf8').digest();
}

// AWS's canonical form needs RFC 3986 encoding, which is stricter than
// encodeURIComponent: it also escapes ! ' ( ) * , which AWS still treats
// as reserved even though the JS built-in leaves them alone.
function rfc3986Encode(value) {
  return encodeURIComponent(value).replace(
    /[!'()*]/g,
    (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase(),
  );
}

function encodeCanonicalUri(key) {
  return '/' + key.split('/').map(rfc3986Encode).join('/');
}

/**
 * Builds an S3 presigned PUT URL by implementing AWS Signature Version 4
 * directly (canonical request -> string to sign -> derived signing key ->
 * signature), with no AWS SDK involved. Returns both the URL and every
 * intermediate value so the process can be shown step by step.
 */
export function buildPresignedPutUrl({
  accessKeyId,
  secretAccessKey,
  region,
  bucket,
  key,
  expiresIn,
}) {
  const service = 's3';
  const host = `${bucket}.s3.${region}.amazonaws.com`;

  const iso = new Date().toISOString(); // e.g. 2026-09-01T09:44:19.123Z
  const amzDate = iso.replace(/[:-]/g, '').split('.')[0] + 'Z'; // 20260901T094419Z
  const dateStamp = amzDate.slice(0, 8); // 20260901

  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const canonicalUri = encodeCanonicalUri(key);

  const queryParams = {
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Credential': `${accessKeyId}/${credentialScope}`,
    'X-Amz-Date': amzDate,
    'X-Amz-Expires': String(expiresIn),
    'X-Amz-SignedHeaders': 'host',
  };
  const canonicalQueryString = Object.keys(queryParams)
    .sort()
    .map((k) => `${rfc3986Encode(k)}=${rfc3986Encode(queryParams[k])}`)
    .join('&');

  const canonicalHeaders = `host:${host}\n`;
  const signedHeaders = 'host';
  const payloadHash = 'UNSIGNED-PAYLOAD';

  const canonicalRequest = [
    'PUT',
    canonicalUri,
    canonicalQueryString,
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n');

  const hashedCanonicalRequest = sha256Hex(canonicalRequest);

  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    hashedCanonicalRequest,
  ].join('\n');

  const kDate = hmac(`AWS4${secretAccessKey}`, dateStamp);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, service);
  const kSigning = hmac(kService, 'aws4_request');
  const signature = crypto
    .createHmac('sha256', kSigning)
    .update(stringToSign, 'utf8')
    .digest('hex');

  const finalQueryString = `${canonicalQueryString}&X-Amz-Signature=${signature}`;
  const url = `https://${host}${canonicalUri}?${finalQueryString}`;

  return {
    url,
    steps: {
      host,
      region,
      amzDate,
      dateStamp,
      credentialScope,
      canonicalUri,
      canonicalQueryString,
      canonicalRequest,
      hashedCanonicalRequest,
      stringToSign,
      signingKeyChain: {
        kDate: kDate.toString('hex'),
        kRegion: kRegion.toString('hex'),
        kService: kService.toString('hex'),
        kSigning: kSigning.toString('hex'),
      },
      signature,
    },
  };
}
