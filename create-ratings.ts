
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function addRatings() {
    const tutor = await prisma.tutor.findFirst({
        include: {
            user: true
        }
    });

    if (!tutor) {
        console.log('No tutor found');
        return;
    }

    console.log(`Adding ratings for Tutor: ${tutor.user.firstName} ${tutor.user.lastName} (ID: ${tutor.id})`);

    const ratingsData = [
        {
            tutorId: tutor.id,
            overallRating: 5.0,
            teachingQuality: 5,
            communication: 5,
            punctuality: 5,
            review: "Dr. Smith is an exceptional teacher. His clarity on complex physics topics is unmatched!"
        },
        {
            tutorId: tutor.id,
            overallRating: 4.5,
            teachingQuality: 5,
            communication: 4,
            punctuality: 5,
            review: "Very professional and always on time. Helped me improve my calculus grades significantly."
        },
        {
            tutorId: tutor.id,
            overallRating: 4.0,
            teachingQuality: 4,
            communication: 5,
            punctuality: 3,
            review: "Great communication, though sometimes sessions run slightly late. Still highly recommend for his knowledge."
        },
        {
            tutorId: tutor.id,
            overallRating: 5.0,
            teachingQuality: 5,
            communication: 5,
            punctuality: 5,
            review: "Absolutely the best! Made organic chemistry actually fun to learn."
        },
        {
            tutorId: tutor.id,
            overallRating: 4.8,
            teachingQuality: 5,
            communication: 5,
            punctuality: 4,
            review: "Patient and thorough. Explains things as many times as needed."
        }
    ];

    let sum = 0;
    for (const data of ratingsData) {
        await prisma.rating.create({ data });
        sum += data.overallRating;
    }

    const averageRating = sum / ratingsData.length;
    const totalReviews = ratingsData.length;

    await prisma.tutor.update({
        where: { id: tutor.id },
        data: {
            averageRating,
            totalReviews: totalReviews
        }
    });

    console.log(`Successfully added 5 ratings. New average: ${averageRating.toFixed(2)}`);
}

addRatings()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect());
