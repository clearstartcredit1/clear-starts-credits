import { Module } from '@nestjs/common';
import { ClientsController } from './clients.controller';
import { DocumentsController } from './documents.controller';
import { ClientsService } from './clients.service';

@Module({
  controllers: [ClientsController, DocumentsController],
  providers: [ClientsService],
})
export class ClientsModule {}
