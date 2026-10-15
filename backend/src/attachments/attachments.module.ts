import { Module } from '@nestjs/common';
import { SubjectsModule } from '../subjects/subjects.module';
import { AttachmentsService } from './attachments.service';
import { AttachmentsController } from './attachments.controller';

@Module({
  imports: [SubjectsModule],
  providers: [AttachmentsService],
  controllers: [AttachmentsController],
})
export class AttachmentsModule {}
