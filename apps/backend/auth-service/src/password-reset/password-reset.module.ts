import { Module } from '@nestjs/common';
import { MailModule } from '../mail/mail.module';
import { PasswordResetService } from './password-reset.service';

@Module({
  imports: [MailModule],
  providers: [PasswordResetService],
  exports: [PasswordResetService],
})
export class PasswordResetModule {}
