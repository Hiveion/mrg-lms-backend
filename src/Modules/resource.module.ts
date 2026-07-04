import { Module } from '@nestjs/common';
import { ResourceController } from '../Controllers/resource.controller';
import { ResourceService } from '../Services/resource.service';
import { DatabaseModule } from '../Database/database.module';
import { GoogleModule } from './google.module';
import { PrismaService } from '../Database/prisma.service';

@Module({
    imports: [DatabaseModule, GoogleModule],
    controllers: [ResourceController],
    providers: [ResourceService, PrismaService],
    exports: [ResourceService],
})
export class ResourceModule { }
