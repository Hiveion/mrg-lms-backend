import { Module } from '@nestjs/common';
import { DashboardController } from '../Controllers/dashboard.controller';
import { DashboardService } from '../Services/dashboard.service';
import { DatabaseModule } from '../Database/database.module';
import { PrismaService } from '../Database/prisma.service';

@Module({
    imports: [DatabaseModule],
    controllers: [DashboardController],
    providers: [DashboardService, PrismaService],
    exports: [DashboardService],
})
export class DashboardModule {}
