import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class StorageService {
  private mode() {
    return (process.env.STORAGE_MODE || 'local').toLowerCase();
  }

  isConfigured() {
    if (this.mode() === 'local') return !!process.env.LOCAL_STORAGE_DIR;
    return false;
  }

  async putObject(key: string, bytes: Buffer, mimeType: string) {
    if (!this.isConfigured()) throw new Error('Storage not configured');
    const baseDir = process.env.LOCAL_STORAGE_DIR!;
    const abs = path.join(baseDir, key);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, bytes);
    const publicBase = process.env.LOCAL_PUBLIC_BASE || 'http://localhost:3001/files';
    const publicUrl = `${publicBase.replace(/\/$/, '')}/${encodeURIComponent(key)}`;
    return { storageKey: key, publicUrl, mimeType };
  }

  async getSignedDownloadUrl(key: string, _expiresSeconds = 600) {
    const publicBase = process.env.LOCAL_PUBLIC_BASE || 'http://localhost:3001/files';
    return `${publicBase.replace(/\/$/, '')}/${encodeURIComponent(key)}`;
  }
}
