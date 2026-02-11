
import { Module } from '@nestjs/common';
import { UsersService } from '../Services/users.service';
import { DatabaseModule } from '../Database/database.module';

@Module({
    imports: [DatabaseModule],
    providers: [UsersService],
    exports: [UsersService],
})
export class UsersModule { }
