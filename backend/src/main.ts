import { createApp } from './app.setup';

async function bootstrap() {
  const app = await createApp();
  await app.listen(process.env.PORT ?? 3001);
}
void bootstrap();
