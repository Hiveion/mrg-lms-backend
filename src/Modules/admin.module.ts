import { Module } from '@nestjs/common';
import { AdminController } from '../Controllers/admin.controller';
import { AdminService } from '../Services/admin.service';
import { PrismaService } from '../Database/prisma.service';

@Module({
    controllers: [AdminController],
    providers: [AdminService, PrismaService],
})
export class AdminModule { }
