import './loadEnv.js';
import express from 'express';
import signedUrlRouter from './routes/signedUrl.js';

const app = express();
app.use(express.json());
app.use('/api', signedUrlRouter);

const port = process.env.PORT || 4000;
app.listen(port, () => {
  console.log(`Signed URL server listening on port ${port}`);
});
