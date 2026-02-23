
import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './Modules/auth.module';
import { UsersModule } from './Modules/users.module';
import { DatabaseModule } from './Database/database.module';
import { SubjectModule } from './Modules/subject.module';

@Module({
  imports: [DatabaseModule, AuthModule, UsersModule, SubjectModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
