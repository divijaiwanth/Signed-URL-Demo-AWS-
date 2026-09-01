const MIME_TYPE_PATTERN = /^[-\w.]+\/[-\w.+]+$/;

export function validateUploadRequest(body) {
  const { filename, contentType } = body ?? {};

  if (!filename || typeof filename !== 'string') {
    return { error: 'filename is required' };
  }
  if (!contentType || !MIME_TYPE_PATTERN.test(contentType)) {
    return { error: 'a valid contentType is required' };
  }

  return { filename, contentType };
}
