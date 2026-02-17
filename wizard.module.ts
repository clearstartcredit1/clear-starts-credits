import { Module } from '@nestjs/common';
import { WizardController } from './wizard.controller';

@Module({ controllers: [WizardController] })
export class WizardModule {}
