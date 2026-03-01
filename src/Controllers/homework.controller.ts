import { Controller, Post, Body, Get, Param, ParseIntPipe, UseGuards, Request } from '@nestjs/common';
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

    @Post()
    create(@Body() createHomeworkDto: CreateHomeworkDto) {
        return this.homeworkService.create(createHomeworkDto);
    }

    @UseGuards(AuthGuard('jwt'))
    @Post('submit')
    submit(@Request() req: any, @Body() submissionDto: CreateHomeworkSubmissionDto) {
        return this.homeworkService.submit(req.user.id, submissionDto);
    }

    @Post('grade/:id')
    grade(@Param('id', ParseIntPipe) id: number, @Body() gradeDto: GradeSubmissionDto) {
        return this.homeworkService.grade(id, gradeDto);
    }

    @Get()
    findAll() {
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
