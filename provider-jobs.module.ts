import { Module } from '@nestjs/common';
import { ProviderJobsService } from './provider-jobs.service';
import { ProviderImportController } from './provider-import.controller';

@Module({
  providers: [ProviderJobsService],
  controllers: [ProviderImportController],
  exports: [ProviderJobsService],
})
export class ProviderJobsModule {}
