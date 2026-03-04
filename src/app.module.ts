
import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './Modules/auth.module';
import { UsersModule } from './Modules/users.module';
import { DatabaseModule } from './Database/database.module';
import { SubjectModule } from './Modules/subject.module';
import { ClassModule } from './Modules/class.module';
import { SessionModule } from './Modules/session.module';
import { EnrollmentModule } from './Modules/enrollment.module';
import { HomeworkModule } from './Modules/homework.module';
import { RatingModule } from './Modules/rating.module';
import { AdminModule } from './Modules/admin.module';
import { MailModule } from './Modules/mail.module';

@Module({
  imports: [DatabaseModule, AuthModule, UsersModule, SubjectModule, ClassModule, SessionModule, EnrollmentModule, HomeworkModule, RatingModule, AdminModule, MailModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
