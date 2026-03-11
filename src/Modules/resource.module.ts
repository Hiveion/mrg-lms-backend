import { Module } from '@nestjs/common';
import { ResourceService } from '../Services/resource.service';
import { ResourceController } from '../Controllers/resource.controller';
import { DatabaseModule } from '../Database/database.module';

@Module({
    imports: [DatabaseModule],
    providers: [ResourceService],
    controllers: [ResourceController],
    exports: [ResourceService],
})
export class ResourceModule { }
