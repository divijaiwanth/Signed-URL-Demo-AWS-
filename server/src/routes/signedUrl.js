import { Router } from 'express';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { s3Client } from '../s3Client.js';
import { validateUploadRequest } from '../validateUploadRequest.js';
import { buildObjectKey } from '../objectKey.js';

const router = Router();

router.post('/signed-url', async (req, res) => {
  const { filename, contentType, error } = validateUploadRequest(req.body);
  if (error) {
    return res.status(400).json({ error });
  }

  const key = buildObjectKey(filename);
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
