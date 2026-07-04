import {
    Controller,
    Get,
    Post,
    Delete,
    Param,
    Body,
    UseGuards,
    Request,
    Res,
    ForbiddenException,
    ParseIntPipe,
    UseInterceptors,
    UploadedFile,
    NotFoundException,
    BadRequestException
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ResourceService } from '../Services/resource.service';
import { GoogleService } from '../Services/google.service';
import { PrismaService } from '../Database/prisma.service';
import { AuthGuard } from '@nestjs/passport';
import { UserRole } from '@prisma/client';
import { CreateResourceDto } from '../DTOs/resource.dto';
import { Response } from 'express';

@Controller('resources')
@UseGuards(AuthGuard('jwt'))
export class ResourceController {
    constructor(
        private readonly resourceService: ResourceService,
        private readonly googleService: GoogleService,
        private readonly prismaService: PrismaService,
    ) { }

    @Post()
    @UseInterceptors(FileInterceptor('file'))
    async uploadResource(
        @Request() req: any,
        @Body() body: any,
        @UploadedFile() file: any,
    ) {
        if (req.user.userType !== UserRole.ADMIN && req.user.userType !== UserRole.COORDINATOR && req.user.userType !== UserRole.TUTOR) {
            throw new ForbiddenException('Only admins and tutors can upload resources');
        }

        const dto: CreateResourceDto = {
            classId: typeof body.classId === 'string' ? parseInt(body.classId, 10) : body.classId,
            title: body.title,
            description: body.description,
        };

        return this.resourceService.create(dto, req.user.id, req.user.userType, file);
    }

    @Get()
    async getResources(@Request() req: any) {
        return this.resourceService.findAllForUser(req.user.id, req.user.userType);
    }

    @Get(':id')
    async getResourceDetails(
        @Param('id', ParseIntPipe) id: number,
        @Request() req: any,
    ) {
        const hasAccess = await this.resourceService.authorizeAccess(id, req.user.id, req.user.userType);
        if (!hasAccess) {
            throw new ForbiddenException('You do not have access to this resource');
        }
        return this.resourceService.findOne(id);
    }

    @Delete(':id')
    async deleteResource(
        @Param('id', ParseIntPipe) id: number,
        @Request() req: any,
    ) {
        return this.resourceService.remove(id, req.user.id, req.user.userType);
    }

    @Get('download/:id')
    async downloadResource(
        @Param('id', ParseIntPipe) id: number,
        @Request() req: any,
        @Res() res: Response,
    ) {
        const hasAccess = await this.resourceService.authorizeAccess(id, req.user.id, req.user.userType);
        if (!hasAccess) {
            throw new ForbiddenException('You do not have access to this resource');
        }

        const resource = await this.resourceService.findOne(id);
        await this.resourceService.incrementDownloadCount(id);

        const tutorUser = resource.class.tutor.user;
        const driveUser = tutorUser.googleRefreshToken
            ? tutorUser
            : await this.prismaService.user.findFirst({ where: { NOT: { googleRefreshToken: null } } });

        if (!driveUser) {
            throw new NotFoundException('No Google credentials found to download this file');
        }

        this.googleService.oauth2Client.setCredentials({
            refresh_token: driveUser.googleRefreshToken,
            access_token: driveUser.googleAccessToken,
        });

        const drive = require('googleapis').google.drive({ version: 'v3', auth: this.googleService.oauth2Client });

        try {
            const fileMeta = await drive.files.get({
                fileId: resource.fileId,
                fields: 'size, mimeType, name'
            });

            const size = fileMeta.data.size;
            const mimeType = fileMeta.data.mimeType;
            const name = fileMeta.data.name;

            res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(name)}"`);
            if (mimeType) res.setHeader('Content-Type', mimeType);
            if (size) res.setHeader('Content-Length', size);

            const driveRes = await drive.files.get(
                { fileId: resource.fileId, alt: 'media' },
                { responseType: 'stream' }
            );

            driveRes.data.pipe(res);
        } catch (err: any) {
            throw new BadRequestException(`Failed to download file from Google Drive: ${err.message}`);
        }
    }
}
