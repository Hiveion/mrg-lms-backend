import { Controller, Post, Body, Get, Param, ParseIntPipe, UseGuards, Request, ForbiddenException, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { HomeworkService } from '../Services/homework.service';
import { CreateHomeworkDto, CreateHomeworkSubmissionDto, GradeSubmissionDto } from '../DTOs/homework.dto';
import { AuthGuard } from '@nestjs/passport';

@Controller('homeworks')
export class HomeworkController {
    constructor(private readonly homeworkService: HomeworkService) { }

    @UseGuards(AuthGuard('jwt'))
    @Get('my-homeworks')
    findMyHomeworks(@Request() req: any) {
        return this.homeworkService.findByStudentUserId(req.user.id);
    }

    @UseGuards(AuthGuard('jwt'))
    @Get('tutor-homeworks')
    findTutorHomeworks(@Request() req: any) {
        return this.homeworkService.findByTutorUserId(req.user.id);
    }

    @UseGuards(AuthGuard('jwt'))
    @Get('tutor-pending-submissions')
    findTutorPendingSubmissions(@Request() req: any) {
        return this.homeworkService.findTutorPendingSubmissions(req.user.id);
    }

    @UseGuards(AuthGuard('jwt'))
    @Get('tutor-graded-submissions')
    findTutorGradedSubmissions(@Request() req: any) {
        return this.homeworkService.findTutorGradedSubmissions(req.user.id);
    }

    @UseGuards(AuthGuard('jwt'))
    @Get('my-submissions')
    findMySubmissions(@Request() req: any) {
        return this.homeworkService.getMySubmissions(req.user.id);
    }

    @UseGuards(AuthGuard('jwt'))
    @Get('my-late-submissions')
    findMyLateSubmissions(@Request() req: any) {
        return this.homeworkService.getMyLateSubmissions(req.user.id);
    }

    @UseGuards(AuthGuard('jwt'))
    @Get('my-graded-submissions')
    findMyGradedSubmissions(@Request() req: any) {
        return this.homeworkService.getMyGradedSubmissions(req.user.id);
    }

    @UseGuards(AuthGuard('jwt'))
    @Get('classes-for-homework')
    getClassesForHomework(@Request() req: any) {
        return this.homeworkService.getClassesForHomework(req.user.id, req.user.userType);
    }

    @UseGuards(AuthGuard('jwt'))
    @Post()
    @UseInterceptors(FileInterceptor('file'))
    create(
        @Request() req: any,
        @Body() body: any,
        @UploadedFile() file?: any
    ) {
        const createHomeworkDto = { ...body };
        if (typeof createHomeworkDto.classId === 'string') {
            createHomeworkDto.classId = parseInt(createHomeworkDto.classId, 10);
        }
        if (typeof createHomeworkDto.totalMarks === 'string') {
            createHomeworkDto.totalMarks = parseFloat(createHomeworkDto.totalMarks);
        }
        if (typeof createHomeworkDto.deadlineDays === 'string') {
            createHomeworkDto.deadlineDays = parseInt(createHomeworkDto.deadlineDays, 10);
        }
        if (typeof createHomeworkDto.questions === 'string') {
            try {
                createHomeworkDto.questions = JSON.parse(createHomeworkDto.questions);
            } catch (e) {
                // ignore
            }
        }
        return this.homeworkService.create(createHomeworkDto, req.user.id, req.user.userType, file);
    }

    @UseGuards(AuthGuard('jwt'))
    @Post('submit')
    @UseInterceptors(FileInterceptor('file'))
    submit(
        @Request() req: any,
        @Body() body: any,
        @UploadedFile() file?: any
    ) {
        const submissionDto = { ...body };
        if (typeof submissionDto.homeworkId === 'string') {
            submissionDto.homeworkId = parseInt(submissionDto.homeworkId, 10);
        }
        if (typeof submissionDto.answers === 'string') {
            try {
                submissionDto.answers = JSON.parse(submissionDto.answers);
            } catch (e) {
                // ignore
            }
        }
        return this.homeworkService.submit(req.user.id, submissionDto, file);
    }

    @UseGuards(AuthGuard('jwt'))
    @Post('grade/:id')
    grade(@Request() req: any, @Param('id', ParseIntPipe) id: number, @Body() gradeDto: GradeSubmissionDto) {
        return this.homeworkService.grade(req.user.id, id, gradeDto);
    }

    @UseGuards(AuthGuard('jwt'))
    @Get('admin-pending-submissions')
    findAdminPendingSubmissions(@Request() req: any) {
        return this.homeworkService.findAllPendingSubmissions();
    }

    @UseGuards(AuthGuard('jwt'))
    @Get('admin-graded-submissions')
    findAdminGradedSubmissions(@Request() req: any) {
        return this.homeworkService.findAllGradedSubmissions();
    }

    @UseGuards(AuthGuard('jwt'))
    @Get()
    findAll(@Request() req: any) {
        return this.homeworkService.findAll();
    }

    @Get(':id')
    findOne(@Param('id', ParseIntPipe) id: number) {
        return this.homeworkService.findOne(id);
    }

    @Get(':id/submissions')
    getSubmissions(@Param('id', ParseIntPipe) id: number) {
        return this.homeworkService.getSubmissionsByHomework(id);
    }

    @Get('class/:classId')
    findByClass(@Param('classId', ParseIntPipe) classId: number) {
        return this.homeworkService.findByClass(classId);
    }
}
