
import { Module } from '@nestjs/common';
import { UsersService } from '../Services/users.service';
import { UsersController } from '../Controllers/users.controller';
import { DatabaseModule } from '../Database/database.module';

@Module({
    imports: [DatabaseModule],
    controllers: [UsersController],
    providers: [UsersService],
    exports: [UsersService],
})
export class UsersModule { }
