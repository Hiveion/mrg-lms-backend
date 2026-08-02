import { Module } from '@nestjs/common';
import { AdminController } from '../Controllers/admin.controller';
import { AdminService } from '../Services/admin.service';
import { PrismaService } from '../Database/prisma.service';

import { GoogleModule } from './google.module';
import { MailModule } from './mail.module';

import { JwtModule } from '@nestjs/jwt';

@Module({
    imports: [
        JwtModule.register({
            secret: process.env.JWT_SECRET!,
            signOptions: { expiresIn: '4h' },
        }),
        GoogleModule,
        MailModule,
    ],
    controllers: [AdminController],
    providers: [AdminService, PrismaService],
})
export class AdminModule { }
