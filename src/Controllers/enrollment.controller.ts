import { Controller, Get, Post, Body, Patch, Param, Delete, ParseIntPipe } from '@nestjs/common';
import { EnrollmentService } from '../Services/enrollment.service';
import { CreateEnrollmentDto, UpdateEnrollmentDto, UpdateAssignedPriceDto } from '../DTOs/enrollment.dto';

@Controller('enrollments')
export class EnrollmentController {
    constructor(private readonly enrollmentService: EnrollmentService) { }

    @Post()
    create(@Body() createEnrollmentDto: CreateEnrollmentDto) {
        return this.enrollmentService.create(createEnrollmentDto);
    }

    @Get()
    findAll() {
        return this.enrollmentService.findAll();
    }

    @Get(':id')
    findOne(@Param('id', ParseIntPipe) id: number) {
        return this.enrollmentService.findOne(id);
    }

    @Patch(':id')
    update(@Param('id', ParseIntPipe) id: number, @Body() updateEnrollmentDto: UpdateEnrollmentDto) {
        return this.enrollmentService.update(id, updateEnrollmentDto);
    }

    @Patch(':id/price')
    updatePrice(@Param('id', ParseIntPipe) id: number, @Body() updatePriceDto: UpdateAssignedPriceDto) {
        return this.enrollmentService.updateAssignedPrice(id, updatePriceDto);
    }

    @Delete(':id')
    remove(@Param('id', ParseIntPipe) id: number) {
        return this.enrollmentService.remove(id);
    }
}
