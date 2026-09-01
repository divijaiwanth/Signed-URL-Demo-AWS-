import { Router } from 'express';
import { buildPresignedPutUrl } from '../sigv4.js';
import { validateUploadRequest } from '../validateUploadRequest.js';
import { buildObjectKey } from '../objectKey.js';

const router = Router();

// Same contract as /signed-url, but the URL is signed by hand with raw
// HMAC-SHA256 (see sigv4.js) instead of the AWS SDK, and the response
// includes every intermediate value so the signing process can be shown
// step by step.
router.post('/signed-url-manual', (req, res) => {
  const { filename, error } = validateUploadRequest(req.body);
  if (error) {
    return res.status(400).json({ error });
  }

  const key = buildObjectKey(filename);
  const expiresIn = Number(process.env.URL_EXPIRY_SECONDS) || 300;

  const { url, steps } = buildPresignedPutUrl({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION,
    bucket: process.env.S3_BUCKET_NAME,
    key,
    expiresIn,
  });

  res.json({ uploadUrl: url, key, expiresIn, steps });
});

export default router;
