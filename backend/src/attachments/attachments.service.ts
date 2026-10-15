import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash, createHmac, randomUUID, timingSafeEqual } from 'crypto';
import { promises as fs, createReadStream } from 'fs';
import * as path from 'path';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { AccessService } from '../subjects/access.service';
import { ContentService } from '../subjects/content.service';

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR || './uploads');
const SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const INLINE_TYPES = /^image\/(png|jpe?g|gif|webp)$/;

@Injectable()
export class AttachmentsService {
  constructor(
    private prisma: PrismaService,
    private access: AccessService,
    private content: ContentService,
  ) {}

  static sign(id: string) {
    return createHmac('sha256', SECRET)
      .update(`attachment:${id}`)
      .digest('hex')
      .slice(0, 32);
  }

  static verify(id: string, sig: string) {
    const expected = Buffer.from(AttachmentsService.sign(id));
    const given = Buffer.from(sig || '');
    return given.length === expected.length && timingSafeEqual(given, expected);
  }

  async upload(
    user: AuthUser,
    subjectId: string,
    nodeId: string | null,
    inline: boolean,
    file: Express.Multer.File | undefined,
  ) {
    if (!file) throw new BadRequestException('No file uploaded');
    // Editors may embed images in proposed edits; listing files on a page
    // is a manager action because it isn't reviewed.
    const access = await this.access.require(
      subjectId,
      user,
      inline ? 'edit' : 'manage',
    );
    if (inline && !INLINE_TYPES.test(file.mimetype)) {
      throw new BadRequestException(
        'Only PNG, JPEG, GIF or WebP images can be embedded',
      );
    }
    if (nodeId) await this.content.findNode(subjectId, nodeId);

    const id = randomUUID();
    const rel = path.join(subjectId, id);
    await fs.mkdir(path.join(UPLOAD_DIR, subjectId), { recursive: true });
    await fs.writeFile(path.join(UPLOAD_DIR, rel), file.buffer);

    const att = await this.prisma.attachment.create({
      data: {
        id,
        subjectId: access.subject.id,
        nodeId,
        filename: path.basename(file.originalname).slice(0, 191),
        contentType: file.mimetype,
        sizeBytes: file.size,
        storagePath: rel,
        checksum: createHash('sha256').update(file.buffer).digest('hex'),
        inline,
        uploadedById: user.id,
      },
    });
    return { ...att, url: this.publicUrl(att.id) };
  }

  publicUrl(id: string) {
    return `/api/attachments/${id}/raw?sig=${AttachmentsService.sign(id)}`;
  }

  async getForUser(user: AuthUser, id: string) {
    const att = await this.find(id);
    const access = await this.access.require(att.subjectId, user, 'preview');
    if (access.previewOnly) {
      const node = att.nodeId
        ? await this.prisma.contentNode.findUnique({
            where: { id: att.nodeId },
          })
        : null;
      if (!node || !(await this.content.isPreviewVisible(node))) {
        throw new ForbiddenException('You need access to this subject');
      }
    }
    return att;
  }

  async getSigned(id: string, sig: string) {
    if (!AttachmentsService.verify(id, sig)) throw new NotFoundException();
    return this.find(id);
  }

  stream(att: { storagePath: string }) {
    return createReadStream(path.join(UPLOAD_DIR, att.storagePath));
  }

  async remove(user: AuthUser, id: string) {
    const att = await this.find(id);
    await this.access.require(att.subjectId, user, 'manage');
    await this.prisma.attachment.delete({ where: { id } });
    await fs
      .unlink(path.join(UPLOAD_DIR, att.storagePath))
      .catch(() => undefined);
    return { ok: true };
  }

  private async find(id: string) {
    const att = await this.prisma.attachment.findUnique({ where: { id } });
    if (!att) throw new NotFoundException('Attachment not found');
    const subject = await this.prisma.subject.findUnique({
      where: { id: att.subjectId },
    });
    if (!subject || subject.deletedAt)
      throw new NotFoundException('Attachment not found');
    return att;
  }
}
