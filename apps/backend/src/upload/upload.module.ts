import { Module } from "@nestjs/common";
import { UploadController } from "./upload.controller";
import { MulterModule } from "@nestjs/platform-express";
import { existsSync, mkdirSync } from "fs";
import { join } from "path";

const UPLOADS_DIR = join(process.cwd(), "uploads");

// Ensure uploads directory exists
if (!existsSync(UPLOADS_DIR)) {
  mkdirSync(UPLOADS_DIR, { recursive: true });
}

@Module({
  imports: [
    MulterModule.register({
      dest: UPLOADS_DIR,
    }),
  ],
  controllers: [UploadController],
})
export class UploadModule {}
