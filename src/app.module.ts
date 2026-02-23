
import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './Modules/auth.module';
import { UsersModule } from './Modules/users.module';
import { DatabaseModule } from './Database/database.module';
import { SubjectModule } from './Modules/subject.module';
import { ClassModule } from './Modules/class.module';

@Module({
  imports: [DatabaseModule, AuthModule, UsersModule, SubjectModule, ClassModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
