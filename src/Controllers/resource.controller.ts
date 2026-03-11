import {
    Controller,
    Get,
    Post,
    Patch,
    Delete,
    Body,
    Param,
    ParseIntPipe,
    UseGuards,
    Request,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ResourceService } from '../Services/resource.service';
import { CreateResourceDto, UpdateResourceDto } from '../DTOs/resource.dto';

@Controller('resources')
@UseGuards(AuthGuard('jwt'))
export class ResourceController {
    constructor(private readonly resourceService: ResourceService) { }

    @Post()
    async create(@Request() req: any, @Body() createResourceDto: CreateResourceDto) {
        return this.resourceService.create(req.user.id, createResourceDto);
    }

    @Get('my-resources')
    async getMyResources(@Request() req: any) {
        return this.resourceService.findMyResources(req.user.id);
    }

    @Get('class/:classId')
    async findByClass(@Request() req: any, @Param('classId', ParseIntPipe) classId: number) {
        return this.resourceService.findByClass(req.user.id, classId);
    }

    @Patch(':id')
    async update(
        @Request() req: any,
        @Param('id', ParseIntPipe) id: number,
        @Body() updateResourceDto: UpdateResourceDto,
    ) {
        return this.resourceService.update(req.user.id, id, updateResourceDto);
    }

    @Delete(':id')
    async remove(@Request() req: any, @Param('id', ParseIntPipe) id: number) {
        return this.resourceService.remove(req.user.id, id);
    }

    @Post(':id/download')
    async incrementDownload(@Param('id', ParseIntPipe) id: number) {
        return this.resourceService.incrementDownload(id);
    }
}
