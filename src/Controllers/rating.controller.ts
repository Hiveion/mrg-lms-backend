import { Controller, Get, Post, Body, Patch, Param, Delete, ParseIntPipe } from '@nestjs/common';
import { RatingService } from '../Services/rating.service';
import { CreateRatingDto, UpdateRatingDto } from '../DTOs/rating.dto';

@Controller('ratings')
export class RatingController {
    constructor(private readonly ratingService: RatingService) { }

    @Post()
    create(@Body() createRatingDto: CreateRatingDto) {
        return this.ratingService.create(createRatingDto);
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
}
