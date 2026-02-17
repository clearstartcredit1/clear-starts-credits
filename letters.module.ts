import { Module } from '@nestjs/common';
import { LettersController } from './letters.controller';

@Module({ controllers: [LettersController] })
export class LettersModule {}
