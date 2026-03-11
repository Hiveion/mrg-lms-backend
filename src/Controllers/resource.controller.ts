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
    UseInterceptors,
    UploadedFile,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import { ResourceService } from '../Services/resource.service';
import { CreateResourceDto, UpdateResourceDto } from '../DTOs/resource.dto';
import { diskStorage } from 'multer';
import { extname } from 'path';

@Controller('resources')
@UseGuards(AuthGuard('jwt'))
export class ResourceController {
    constructor(private readonly resourceService: ResourceService) { }

    @Post()
    @UseInterceptors(FileInterceptor('file', {
        storage: diskStorage({
            destination: './uploads/resources',
            filename: (req, file, cb) => {
                const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
                cb(null, `${file.fieldname}-${uniqueSuffix}${extname(file.originalname)}`);
            },
        }),
    }))
    async create(
        @Request() req: any,
        @UploadedFile() file: Express.Multer.File,
        @Body() body: any
    ) {
        const createResourceDto: CreateResourceDto = {
            classId: parseInt(body.classId),
            title: body.title,
            description: body.description,
            fileUrl: file ? `/uploads/resources/${file.filename}` : body.fileUrl,
            fileType: file ? extname(file.originalname).replace('.', '').toLowerCase() : body.fileType,
            fileSize: file ? file.size : parseInt(body.fileSize || 0),
        };
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
