import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  UseGuards,
  Get,
  Param,
  Res,
  BadRequestException,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { diskStorage } from "multer";
import { extname, join } from "path";
import { existsSync, mkdirSync } from "fs";
import { Response } from "express";
import { v4 as uuid } from "uuid";
import { AuthGuard } from "@nestjs/passport";

// Absolute path, not one derived from cwd: dev runs the server from the package
// directory while the production image runs it from the repo root, so a relative
// path resolves to two different places — and only one of them is the mounted
// volume. UPLOADS_DIR is set explicitly in both compose files.
const UPLOADS_DIR = process.env.UPLOADS_DIR ?? join(process.cwd(), "uploads");

// Multer errors on a missing destination, and a fresh volume mounts empty.
mkdirSync(UPLOADS_DIR, { recursive: true });

@Controller("uploads")
export class UploadController {
  @Post()
  @UseGuards(AuthGuard("jwt"))
  @UseInterceptors(
    FileInterceptor("file", {
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          cb(null, UPLOADS_DIR);
        },
        filename: (_req, file, cb) => {
          const ext = extname(file.originalname).toLowerCase();
          const filename = `${uuid()}${ext}`;
          cb(null, filename);
        },
      }),
      limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
      fileFilter: (_req, file, cb) => {
        const allowedMimes = [
          "image/jpeg",
          "image/png",
          "image/webp",
          "image/gif",
          "image/svg+xml",
        ];
        if (allowedMimes.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(
            new BadRequestException(
              "Tipo de arquivo não permitido. Use: JPG, PNG, WebP, GIF ou SVG.",
            ),
            false,
          );
        }
      },
    }),
  )
  uploadFile(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException("Nenhum arquivo enviado");
    }

    return {
      url: `/uploads/${file.filename}`,
      filename: file.filename,
      size: file.size,
      mimetype: file.mimetype,
    };
  }

  @Get(":filename")
  serveFile(@Param("filename") filename: string, @Res() res: Response) {
    // Sanitize filename to prevent directory traversal
    const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "");
    const filePath = join(UPLOADS_DIR, safeName);

    if (!existsSync(filePath)) {
      return res.status(404).json({ message: "Arquivo não encontrado" });
    }

    return res.sendFile(filePath);
  }
}
