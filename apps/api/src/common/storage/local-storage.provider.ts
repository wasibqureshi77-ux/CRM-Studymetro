import { Injectable } from '@nestjs/common';
import { StorageProvider } from './storage-provider.interface';
import * as path from 'path';
import * as fs from 'fs';

@Injectable()
export class LocalStorageProvider implements StorageProvider {
  private readonly uploadRoot = path.resolve(process.cwd(), 'uploads');

  constructor() {
    if (!fs.existsSync(this.uploadRoot)) {
      fs.mkdirSync(this.uploadRoot, { recursive: true });
    }
  }

  async upload(file: Express.Multer.File, targetPath: string): Promise<string> {
    const destinationDir = path.join(this.uploadRoot, path.dirname(targetPath));
    if (!fs.existsSync(destinationDir)) {
      fs.mkdirSync(destinationDir, { recursive: true });
    }

    const finalPath = path.join(this.uploadRoot, targetPath);
    
    // If the file is already saved by multer, we can move or copy it.
    // Multer saves files temporarily or directly. Let's write the buffer if present, or move the temp file.
    if (file.path && fs.existsSync(file.path)) {
      fs.renameSync(file.path, finalPath);
    } else if (file.buffer) {
      fs.writeFileSync(finalPath, file.buffer);
    } else {
      throw new Error('No file path or buffer found for upload');
    }

    return targetPath; // Store relative path in DB
  }

  async delete(fileUrl: string): Promise<void> {
    const fullPath = path.join(this.uploadRoot, fileUrl);
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }
  }

  getUrl(filePath: string): string {
    return filePath;
  }
}
