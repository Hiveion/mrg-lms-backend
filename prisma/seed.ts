
import { PrismaClient, UserRole, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Start seeding...');

  // Clean up existing data in correct order
  await prisma.replyLike.deleteMany();
  await prisma.discussionLike.deleteMany();
  await prisma.discussionReply.deleteMany();
  await prisma.discussionThread.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.ratingLike.deleteMany();
  await prisma.rating.deleteMany();
  await prisma.submissionAnswer.deleteMany();
  await prisma.homeworkSubmission.deleteMany();
  await prisma.homeworkQuestion.deleteMany();
  await prisma.homework.deleteMany();
  await prisma.session.deleteMany();
  await prisma.classSchedule.deleteMany();
  await prisma.enrollment.deleteMany();
  await prisma.class.deleteMany();
  await prisma.subject.deleteMany();
  await prisma.parentStudent.deleteMany();
  await prisma.student.deleteMany();
  await prisma.tutor.deleteMany();
  await prisma.parent.deleteMany();
  await prisma.coordinator.deleteMany();
  await prisma.user.deleteMany();

  const passwordHash = await bcrypt.hash('password123', 10);

  // 0. Create Admin: Super Admin
  await prisma.user.create({
    data: {
      email: 'admin@mrg-lms.com',
      passwordHash,
      firstName: 'Super',
      lastName: 'Admin',
      status: UserStatus.ACTIVE,
      userType: UserRole.ADMIN,
      timezone: 'Asia/Colombo',
    },
  });

  // 1. Create Tutor: Dr. Robert Smith
  await prisma.user.create({
    data: {
      email: 'robert.smith@mrg-lms.com',
      passwordHash,
      firstName: 'Robert',
      lastName: 'Smith',
      status: UserStatus.ACTIVE,
      userType: UserRole.TUTOR,
      timezone: 'Asia/Colombo',
      tutorProfile: {
        create: {
          bio: 'Ph.D. in Theoretical Physics with 15 years of teaching experience.',
          qualifications: ['Ph.D. Physics', 'M.Ed. Secondary Education'],
          applicationStatus: 'ACCEPTED',
          hourlyRate: 25.0,
          currency: 'MVR',
        },
      },
    },
    include: { tutorProfile: true },
  });

  // 2. Create Tutor: Priya Fernando
  await prisma.user.create({
    data: {
      email: 'priya.fernando@mrg-lms.com',
      passwordHash,
      firstName: 'Priya',
      lastName: 'Fernando',
      status: UserStatus.ACTIVE,
      userType: UserRole.TUTOR,
      timezone: 'Asia/Colombo',
      tutorProfile: {
        create: {
          bio: 'M.Sc. in Computer Science, specializing in full-stack web development and algorithms.',
          qualifications: ['M.Sc. Computer Science', 'B.Sc. Software Engineering'],
          applicationStatus: 'ACCEPTED',
          hourlyRate: 20.0,
          currency: 'MVR',
        },
      },
    },
    include: { tutorProfile: true },
  });

  // 3. Create Student: Alice Johnson
  await prisma.user.create({
    data: {
      email: 'alice.johnson@example.com',
      passwordHash,
      firstName: 'Alice',
      lastName: 'Johnson',
      status: UserStatus.ACTIVE,
      userType: UserRole.STUDENT,
      timezone: 'Asia/Kuala_Lumpur',
      studentProfile: {
        create: { grade: 'Grade 12' },
      },
    },
    include: { studentProfile: true },
  });

  // 4. Create Student: Bob Martin
  await prisma.user.create({
    data: {
      email: 'bob.martin@example.com',
      passwordHash,
      firstName: 'Bob',
      lastName: 'Martin',
      status: UserStatus.ACTIVE,
      userType: UserRole.STUDENT,
      timezone: 'Europe/London',
      studentProfile: { create: { grade: 'Grade 11' } },
    },
    include: { studentProfile: true },
  });

  console.log('Seeding finished successfully.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
