import { Readable } from 'stream';

export interface StorageProvider {
  upload(file: Express.Multer.File, targetPath: string): Promise<string>;
  delete(fileUrl: string): Promise<void>;
  getUrl(filePath: string): string;
}
