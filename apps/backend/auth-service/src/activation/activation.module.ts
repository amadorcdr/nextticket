import { Module } from '@nestjs/common';
import { MailModule } from '../mail/mail.module';
import { ActivationService } from './activation.service';

@Module({
  imports: [MailModule],
  providers: [ActivationService],
  exports: [ActivationService],
})
export class ActivationModule {}
