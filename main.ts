import 'reflect-metadata';
import * as dotenv from 'dotenv';
dotenv.config({ path: '/app/.env' });
dotenv.config();

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as express from 'express';
import * as path from 'path';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { cors: true });

  // Local file serving (storage)
  const localDir = process.env.LOCAL_STORAGE_DIR;
  if ((process.env.STORAGE_MODE || 'local') === 'local' && localDir) {
    app.use('/files', express.static(path.resolve(localDir)));
  }

  // For Stripe/raw webhooks later you can add express.raw route, not needed now.

  await app.listen(3001);
  console.log('API running on http://localhost:3001');
}
bootstrap();
