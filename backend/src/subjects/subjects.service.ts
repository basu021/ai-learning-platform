import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSubjectDto, UpdateSubjectDto } from './dto/create-subject.dto';

@Injectable()
export class SubjectsService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, dto: CreateSubjectDto) {
    return this.prisma.subject.create({
      data: { ...dto, userId },
      include: { topics: true },
    });
  }

  async findAll(userId: string) {
    return this.prisma.subject.findMany({
      where: { userId, deletedAt: null },
      include: {
        topics: {
          where: { deletedAt: null },
          include: {
            subtopics: { where: { deletedAt: null } },
          },
        },
      },
      orderBy: { order: 'asc' },
    });
  }

  async findOne(id: string, userId: string) {
    const subject = await this.prisma.subject.findFirst({
      where: { id, userId, deletedAt: null },
      include: {
        topics: {
          where: { deletedAt: null },
          include: {
            subtopics: {
              where: { deletedAt: null },
              include: {
                _count: { select: { tasks: true } },
              },
            },
          },
        },
      },
    });
    if (!subject) throw new NotFoundException('Subject not found');
    return subject;
  }

  async update(id: string, userId: string, dto: UpdateSubjectDto) {
    await this.findOne(id, userId);
    return this.prisma.subject.update({
      where: { id },
      data: dto,
    });
  }

  async remove(id: string, userId: string) {
    await this.findOne(id, userId);
    return this.prisma.subject.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}
