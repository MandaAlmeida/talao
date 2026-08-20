import type { VercelRequest, VercelResponse } from '@vercel/node';
import serverlessExpress from 'serverless-http';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { createApp } from '../src/app.setup';

let cachedHandler: ReturnType<typeof serverlessExpress> | null = null;

async function getHandler() {
  if (!cachedHandler) {
    const app: NestExpressApplication = await createApp();
    await app.init();
    cachedHandler = serverlessExpress(app.getHttpAdapter().getInstance());
  }
  return cachedHandler;
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
) {
  const serverlessHandler = await getHandler();
  return serverlessHandler(req, res);
}
