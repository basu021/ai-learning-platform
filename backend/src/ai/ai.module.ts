import { Module } from '@nestjs/common';
import { AiService } from './ai.service';
import { AiController } from './ai.controller';
import { OpenAIProvider } from './providers/openai.provider';

@Module({
  providers: [AiService, OpenAIProvider],
  controllers: [AiController],
  exports: [AiService],
})
export class AiModule {}
