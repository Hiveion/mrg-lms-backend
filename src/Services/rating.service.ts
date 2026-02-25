import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../Database/prisma.service';
import { CreateRatingDto, UpdateRatingDto } from '../DTOs/rating.dto';

@Injectable()
export class RatingService {
    constructor(private prisma: PrismaService) { }

    async create(createRatingDto: CreateRatingDto) {
        const tutor = await this.prisma.tutor.findUnique({
            where: { id: createRatingDto.tutorId },
        });

        if (!tutor) {
            throw new NotFoundException(`Tutor with ID ${createRatingDto.tutorId} not found`);
        }

        const rating = await this.prisma.rating.create({
            data: createRatingDto,
            include: {
                tutor: {
                    include: {
                        user: {
                            select: {
                                firstName: true,
                                lastName: true,
                            },
                        },
                    },
                },
            },
        });

        // Update tutor average rating and total reviews
        const tutorRatings = await this.prisma.rating.findMany({
            where: { tutorId: createRatingDto.tutorId },
        });

        const totalReviews = tutorRatings.length;
        const averageRating = tutorRatings.reduce((acc, curr) => acc + curr.overallRating, 0) / totalReviews;

        await this.prisma.tutor.update({
            where: { id: createRatingDto.tutorId },
            data: {
                averageRating,
                totalReviews,
            },
        });

        return rating;
    }

    async findAll() {
        return this.prisma.rating.findMany({
            include: {
                tutor: {
                    include: {
                        user: {
                            select: {
                                firstName: true,
                                lastName: true,
                            },
                        },
                    },
                },
            },
        });
    }

    async findByTutor(tutorId: number) {
        return this.prisma.rating.findMany({
            where: { tutorId },
            include: {
                tutor: {
                    include: {
                        user: {
                            select: {
                                firstName: true,
                                lastName: true,
                            },
                        },
                    },
                },
            },
        });
    }

    async findOne(id: number) {
        const rating = await this.prisma.rating.findUnique({
            where: { id },
            include: {
                tutor: {
                    include: {
                        user: {
                            select: {
                                firstName: true,
                                lastName: true,
                            },
                        },
                    },
                },
            },
        });

        if (!rating) {
            throw new NotFoundException(`Rating with ID ${id} not found`);
        }

        return rating;
    }

    async update(id: number, updateRatingDto: UpdateRatingDto) {
        const existingRating = await this.prisma.rating.findUnique({
            where: { id },
        });

        if (!existingRating) {
            throw new NotFoundException(`Rating with ID ${id} not found`);
        }

        const updatedRating = await this.prisma.rating.update({
            where: { id },
            data: updateRatingDto,
        });

        // If overall rating changed, update tutor average
        if (updateRatingDto.overallRating !== undefined) {
            const tutorRatings = await this.prisma.rating.findMany({
                where: { tutorId: existingRating.tutorId },
            });

            const totalReviews = tutorRatings.length;
            const averageRating = tutorRatings.reduce((acc, curr) => acc + curr.overallRating, 0) / totalReviews;

            await this.prisma.tutor.update({
                where: { id: existingRating.tutorId },
                data: {
                    averageRating,
                    totalReviews,
                },
            });
        }

        return updatedRating;
    }

    async remove(id: number) {
        const rating = await this.prisma.rating.findUnique({
            where: { id },
        });

        if (!rating) {
            throw new NotFoundException(`Rating with ID ${id} not found`);
        }

        await this.prisma.rating.delete({
            where: { id },
        });

        // Update tutor average rating and total reviews
        const tutorRatings = await this.prisma.rating.findMany({
            where: { tutorId: rating.tutorId },
        });

        const totalReviews = tutorRatings.length;
        const averageRating = totalReviews > 0
            ? tutorRatings.reduce((acc, curr) => acc + curr.overallRating, 0) / totalReviews
            : 0;

        await this.prisma.tutor.update({
            where: { id: rating.tutorId },
            data: {
                averageRating,
                totalReviews,
            },
        });

        return { message: 'Rating deleted successfully' };
    }
}
