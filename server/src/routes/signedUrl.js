import { randomUUID } from 'crypto';
import { Router } from 'express';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { s3Client } from '../s3Client.js';

const router = Router();

const MIME_TYPE_PATTERN = /^[-\w.]+\/[-\w.+]+$/;

function sanitizeFilename(filename) {
  return filename.replace(/[^a-zA-Z0-9._-]/g, '_');
}

router.post('/signed-url', async (req, res) => {
  const { filename, contentType } = req.body ?? {};

  if (!filename || typeof filename !== 'string') {
    return res.status(400).json({ error: 'filename is required' });
  }
  if (!contentType || !MIME_TYPE_PATTERN.test(contentType)) {
    return res.status(400).json({ error: 'a valid contentType is required' });
  }

  const key = `uploads/${randomUUID()}-${sanitizeFilename(filename)}`;
  const expiresIn = Number(process.env.URL_EXPIRY_SECONDS) || 300;

  const command = new PutObjectCommand({
    Bucket: process.env.S3_BUCKET_NAME,
    Key: key,
    ContentType: contentType,
  });

  try {
    const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn });
    res.json({ uploadUrl, key, expiresIn });
  } catch (err) {
    console.error('Failed to create signed URL:', err);
    res.status(500).json({ error: 'failed to create signed URL' });
  }
});

export default router;
