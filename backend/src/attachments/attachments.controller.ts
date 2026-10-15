import {
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Res,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  CurrentUser,
  type AuthUser,
} from '../common/decorators/current-user.decorator';
import { AttachmentsService, MAX_UPLOAD_BYTES } from './attachments.service';

function disposition(filename: string, inline: boolean) {
  return `${inline ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

@Controller('api')
export class AttachmentsController {
  constructor(private attachments: AttachmentsService) {}

  @Post('subjects/:id/attachments')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_UPLOAD_BYTES } }),
  )
  upload(
    @CurrentUser() user: AuthUser,
    @Param('id') subjectId: string,
    @Query('nodeId') nodeId: string | undefined,
    @Query('inline') inline: string | undefined,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.attachments.upload(
      user,
      subjectId,
      nodeId || null,
      inline === '1',
      file,
    );
  }

  @Get('attachments/:id')
  @UseGuards(JwtAuthGuard)
  async download(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const att = await this.attachments.getForUser(user, id);
    res.set({
      'Content-Type': att.contentType || 'application/octet-stream',
      'Content-Disposition': disposition(att.filename, false),
    });
    return new StreamableFile(this.attachments.stream(att));
  }

  /** Capability URL used for images embedded in rich content. */
  @Get('attachments/:id/raw')
  async raw(
    @Param('id') id: string,
    @Query('sig') sig: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const att = await this.attachments.getSigned(id, sig);
    // Only images render inline; anything else downloads so it can't run on our origin.
    const isImage = /^image\/(png|jpe?g|gif|webp)$/.test(att.contentType || '');
    res.set({
      'Content-Type': isImage ? att.contentType! : 'application/octet-stream',
      'Content-Disposition': disposition(att.filename, isImage),
      'Cache-Control': 'private, max-age=86400',
      'X-Content-Type-Options': 'nosniff',
    });
    return new StreamableFile(this.attachments.stream(att));
  }

  @Delete('attachments/:id')
  @UseGuards(JwtAuthGuard)
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.attachments.remove(user, id);
  }
}
