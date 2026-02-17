import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';

import { PrismaModule } from './prisma/prisma.module';
import { MailModule } from './mail/mail.module';
import { StorageModule } from './storage/storage.module';

import { AuthModule } from './auth/auth.module';
import { ClientsModule } from './clients/clients.module';
import { ReportsModule } from './reports/reports.module';
import { AuditModule } from './audit/audit.module';
import { DisputesModule } from './disputes/disputes.module';
import { LettersModule } from './letters/letters.module';
import { PortalModule } from './portal/portal.module';
import { TasksModule } from './tasks/tasks.module';
import { ActivityModule } from './activity/activity.module';
import { ProviderJobsModule } from './provider-jobs/provider-jobs.module';
import { TeamModule } from './team/team.module';
import { AutomationModule } from './automation/automation.module';
import { WizardModule } from './wizard/wizard.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    PrismaModule,
    MailModule,
    StorageModule,

    AuthModule,
    ClientsModule,
    ReportsModule,
    AuditModule,
    DisputesModule,
    LettersModule,
    PortalModule,
    TasksModule,
    ActivityModule,
    ProviderJobsModule,
    TeamModule,
    AutomationModule,
    WizardModule,
  ],
})
export class AppModule {}
