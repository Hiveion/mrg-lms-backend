import { Controller, Get, Post, Body, Patch, Param, Delete, ParseIntPipe, UseGuards, Request } from '@nestjs/common';
import { RatingService } from '../Services/rating.service';
import { CreateRatingDto, UpdateRatingDto } from '../DTOs/rating.dto';
import { AuthGuard } from '@nestjs/passport';

@Controller('ratings')
export class RatingController {
    constructor(private readonly ratingService: RatingService) { }

    @UseGuards(AuthGuard('jwt'))
    @Post()
    create(@Request() req: any, @Body() createRatingDto: CreateRatingDto) {
        return this.ratingService.create(req.user.id, createRatingDto);
    }

    @Get()
    findAll() {
        return this.ratingService.findAll();
    }

    @Get('tutor/:tutorId')
    findByTutor(@Param('tutorId', ParseIntPipe) tutorId: number) {
        return this.ratingService.findByTutor(tutorId);
    }

    @Get(':id')
    findOne(@Param('id', ParseIntPipe) id: number) {
        return this.ratingService.findOne(id);
    }

    @Patch(':id')
    update(@Param('id', ParseIntPipe) id: number, @Body() updateRatingDto: UpdateRatingDto) {
        return this.ratingService.update(id, updateRatingDto);
    }

    @Delete(':id')
    remove(@Param('id', ParseIntPipe) id: number) {
        return this.ratingService.remove(id);
    }

    @UseGuards(AuthGuard('jwt'))
    @Post(':id/like')
    addLike(@Param('id', ParseIntPipe) id: number, @Request() req: any) {
        return this.ratingService.addLike(id, req.user.id);
    }

    @UseGuards(AuthGuard('jwt'))
    @Delete(':id/like')
    removeLike(@Param('id', ParseIntPipe) id: number, @Request() req: any) {
        return this.ratingService.removeLike(id, req.user.id);
    }
}
