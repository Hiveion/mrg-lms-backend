
import { PrismaClient, UserRole, UserStatus, HomeworkType, DeadlineType, QuestionType, SubmissionStatus, SessionStatus, EnrollmentStatus, Subject, Class } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Start seeding...');

  // Clean up existing data in correct order
  await prisma.submissionAnswer.deleteMany();
  await prisma.homeworkSubmission.deleteMany();
  await prisma.homeworkQuestion.deleteMany();
  await prisma.homework.deleteMany();
  await prisma.session.deleteMany();
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

  // 1. Create one Tutor: Dr. Robert Smith
  const tutorUser = await prisma.user.create({
    data: {
      email: 'robert.smith@mrg-lms.com',
      passwordHash,
      firstName: 'Robert',
      lastName: 'Smith',
      status: UserStatus.ACTIVE,
      userType: UserRole.TUTOR,
      tutorProfile: {
        create: {
          bio: 'Ph.D. in Theoretical Physics with 15 years of teaching experience.',
          qualifications: ['Ph.D. Physics', 'M.Ed. Secondary Education'],
          applicationStatus: 'ACCEPTED',
        },
      },
    },
    include: { tutorProfile: true },
  });

  // 2. Create one Student: Alice Johnson
  const studentUser = await prisma.user.create({
    data: {
      email: 'alice.johnson@example.com',
      passwordHash,
      firstName: 'Alice',
      lastName: 'Johnson',
      status: UserStatus.ACTIVE,
      userType: UserRole.STUDENT,
      studentProfile: {
        create: {
          grade: 'Grade 12',
        },
      },
    },
    include: { studentProfile: true },
  });

  const tutorId = tutorUser.tutorProfile!.id;
  const studentId = studentUser.studentProfile!.id;

  // 3. Create 10 Subjects with Real Names
  const subjectData = [
    { name: 'Mathematics', code: 'MATH101', desc: 'Advanced Calculus and Linear Algebra' },
    { name: 'Physics', code: 'PHYS101', desc: 'Classical and Quantum Mechanics' },
    { name: 'Chemistry', code: 'CHEM101', desc: 'Organic and Analytical Chemistry' },
    { name: 'Biology', code: 'BIOL101', desc: 'Genetics, Evolution and Physiology' },
    { name: 'History', code: 'HIST101', desc: 'Modern World History and Civilizations' },
    { name: 'Geography', code: 'GEOG101', desc: 'Physical and Environmental Geography' },
    { name: 'English Literature', code: 'ENGL101', desc: 'Creative Writing and Classic Literature' },
    { name: 'Computer Science', code: 'CS101', desc: 'Algorithms, Data Structures and Web Development' },
    { name: 'Economics', code: 'ECON101', desc: 'Micro and Macro Economics' },
    { name: 'Fine Arts', code: 'ARTS101', desc: 'Digital Illustration and Renaissance Art' },
  ];

  const subjects: Subject[] = [];
  for (const s of subjectData) {
    const subject = await prisma.subject.create({
      data: {
        name: s.name,
        code: s.code,
        description: s.desc,
      },
    });
    subjects.push(subject);
  }

  // 4. Create 10 Classes with Real Names
  const classData = [
    { name: 'Advanced Calculus BC', fee: 150.0 },
    { name: 'Quantum Mechanics Intro', fee: 180.0 },
    { name: 'Organic Chemistry Lab', fee: 160.0 },
    { name: 'Molecular Genetics', fee: 140.0 },
    { name: 'The Industrial Revolution', fee: 120.0 },
    { name: 'Climate Change Analytics', fee: 130.0 },
    { name: 'Shakespearean Drama', fee: 110.0 },
    { name: 'Full-stack Web Dev (React/Nest)', fee: 200.0 },
    { name: 'International Trade Policy', fee: 140.0 },
    { name: 'Modern Digital Painting', fee: 120.0 },
  ];

  const classes: Class[] = [];
  for (let i = 0; i < 10; i++) {
    const classItem = await prisma.class.create({
      data: {
        name: classData[i].name,
        subjectId: subjects[i].id,
        tutorId: tutorId,
        grade: 'Grade 12',
        isActive: true,
        classFee: classData[i].fee,
        maxStudentCount: 25,
      },
    });
    classes.push(classItem);
  }

  // 5. Enroll student in 5 classes (First 5)
  const enrolledClasses = classes.slice(0, 5);
  for (const c of enrolledClasses) {
    await prisma.enrollment.create({
      data: {
        studentId: studentId,
        classId: c.id,
        assignedPrice: c.classFee,
        status: EnrollmentStatus.ACTIVE,
      },
    });
  }

  // 6. Sessions for each class
  // 2 sessions for each class: one this week, one next week. 
  // And ensure there is a session TODAY for the student's classes.
  const today = new Date();
  today.setHours(16, 0, 0, 0); // 4 PM today

  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay()); // Sunday of this week

  const nextWeek = new Date(today);
  nextWeek.setDate(today.getDate() + 7);

  for (let i = 0; i < 10; i++) {
    const classItem = classes[i];

    // Status distribution for the first few classes (Alice's classes)
    let status: SessionStatus = SessionStatus.SCHEDULED;
    let dateTime = new Date(today);
    let link = `https://meet.google.com/class-${i}-session-1`;
    let reason: string | null = null;

    if (i === 0) {
      status = SessionStatus.ONGOING;
      dateTime = new Date(today);
      dateTime.setHours(today.getHours() - 1); // Started 1 hour ago
    } else if (i === 1) {
      status = SessionStatus.COMPLETED;
      dateTime = new Date(today);
      dateTime.setDate(today.getDate() - 1); // Yesterday
    } else if (i === 2) {
      status = SessionStatus.CANCELLED;
      dateTime = new Date(today);
      reason = 'Tutor unavailable due to medical emergency.';
    } else if (i === 3) {
      status = SessionStatus.RESCHEDULED;
      dateTime = new Date(today);
      dateTime.setDate(today.getDate() - 2); // 2 days ago
      reason = 'Internet outage in the area.';
    } else {
      // Normal scheduled sessions for the rest of the week
      dateTime = new Date(startOfWeek);
      dateTime.setDate(startOfWeek.getDate() + (i % 6) + 1);
      dateTime.setHours(10 + (i % 5), 0, 0, 0);
    }

    await prisma.session.create({
      data: {
        classId: classItem.id,
        dateTime: dateTime,
        duration: 90,
        status: status,
        link: link,
        cancellationReason: reason,
      },
    });

    // session next week (Always SCHEDULED)
    const nextWeekDate = new Date(nextWeek);
    nextWeekDate.setDate(nextWeek.getDate() + (i % 7));
    nextWeekDate.setHours(11 + (i % 4), 30, 0, 0);

    await prisma.session.create({
      data: {
        classId: classItem.id,
        dateTime: nextWeekDate,
        duration: 90,
        status: SessionStatus.SCHEDULED,
        link: `https://meet.google.com/class-${i}-next-week`,
      },
    });
  }

  // 7. 2 Upcoming Homeworks for each class
  const allHomeworks: any[] = [];
  const hwQuestions = [
    { text: 'Is the derivative of e^x equal to e^x?', type: QuestionType.TRUE_FALSE, ans: 'TRUE' },
    { text: 'Solve for x: 2x + 5 = 15', type: QuestionType.SHORT, ans: '5' },
    { text: 'Is light both a particle and a wave?', type: QuestionType.TRUE_FALSE, ans: 'TRUE' },
    { text: 'What is the chemical symbol for Gold?', type: QuestionType.SHORT, ans: 'Au' },
  ];

  for (let i = 0; i < 10; i++) {
    const classItem = classes[i];

    // Quiz Homework
    const quizHomework = await prisma.homework.create({
      data: {
        classId: classItem.id,
        title: `${classItem.name} Weekly Quiz`,
        description: `Review quiz for ${classItem.name} topics.`,
        type: HomeworkType.QUIZ,
        totalMarks: 20,
        deadlineType: DeadlineType.FIXED_DATE,
        deadlineDate: new Date(today.getTime() + 5 * 24 * 60 * 60 * 1000), // 5 days from now
        questions: {
          create: [
            {
              questionText: hwQuestions[i % 4].text,
              questionType: hwQuestions[i % 4].type,
              marks: 10,
              correctAnswer: hwQuestions[i % 4].ans,
            },
            {
              questionText: 'Is the earth flat?',
              questionType: QuestionType.TRUE_FALSE,
              marks: 10,
              correctAnswer: 'FALSE',
            },
          ],
        },
      },
      include: { questions: true },
    });
    allHomeworks.push(quizHomework);

    // File Homework
    const fileHomework = await prisma.homework.create({
      data: {
        classId: classItem.id,
        title: `${classItem.name} Main Project`,
        description: `Deep dive project for ${classItem.name}. Submit as PDF.`,
        type: HomeworkType.FILE,
        fileUrl: 'https://mrg-lms-assets.s3.amazonaws.com/templates/project_brief.pdf',
        totalMarks: 100,
        deadlineType: DeadlineType.FIXED_DATE,
        deadlineDate: new Date(today.getTime() + 12 * 24 * 60 * 60 * 1000), // 12 days from now
      },
    });
    allHomeworks.push(fileHomework);
  }

  // 8. Submissions
  // Student enrolled in class[0..4]. Homeworks for these classes are allHomeworks[0..9]

  // 2 regular submissions (SUBMITTED)
  for (let i = 0; i < 2; i++) {
    await prisma.homeworkSubmission.create({
      data: {
        homeworkId: allHomeworks[i].id, // Index 0 (Quiz Class 1), 1 (File Class 1)
        studentId: studentId,
        status: SubmissionStatus.SUBMITTED,
        submittedAt: new Date(today.getTime() - 2 * 60 * 60 * 1000), // 2 hours ago
        submissionFileUrl: allHomeworks[i].type === HomeworkType.FILE ? 'https://example.com/alice_project.pdf' : null,
      },
    });
  }

  // 1 late submission (LATE)
  const lateDate = new Date(today);
  lateDate.setDate(today.getDate() - 5);
  const lateHw = await prisma.homework.create({
    data: {
      classId: classes[0].id,
      title: 'Mandatory Calculus Review (Overdue)',
      type: HomeworkType.FILE,
      totalMarks: 100,
      deadlineType: DeadlineType.FIXED_DATE,
      deadlineDate: lateDate,
    },
  });
  await prisma.homeworkSubmission.create({
    data: {
      homeworkId: lateHw.id,
      studentId: studentId,
      status: SubmissionStatus.LATE,
      submittedAt: new Date(),
      submissionFileUrl: 'https://example.com/alice_late_work.pdf',
    },
  });

  // 4 graded submissions (2 quizes and 2 files)
  // 2 Quizes Graded (Using classes 2 and 3)
  for (let i = 0; i < 2; i++) {
    const hwIndex = (i + 1) * 2; // Index 2 (Quiz Class 2), 4 (Quiz Class 3)
    const hw = allHomeworks[hwIndex];
    await prisma.homeworkSubmission.create({
      data: {
        homeworkId: hw.id,
        studentId: studentId,
        status: SubmissionStatus.GRADED,
        totalMarksAwarded: 20,
        feedback: 'Excellent reasoning and accuracy.',
        submittedAt: new Date(today.getTime() - 3 * 24 * 60 * 60 * 1000),
        answers: {
          create: hw.questions.map((q: any) => ({
            questionId: q.id,
            answerText: q.correctAnswer,
            marksAwarded: q.marks,
          })),
        },
      },
    });
  }

  // 2 Files Graded (Using classes 2 and 3)
  for (let i = 0; i < 2; i++) {
    const hwIndex = (i + 1) * 2 + 1; // Index 3 (File Class 2), 5 (File Class 3)
    const hw = allHomeworks[hwIndex];
    await prisma.homeworkSubmission.create({
      data: {
        homeworkId: hw.id,
        studentId: studentId,
        status: SubmissionStatus.GRADED,
        totalMarksAwarded: 92 + i * 3,
        feedback: 'Very thorough research and professional presentation.',
        submittedAt: new Date(today.getTime() - 4 * 24 * 60 * 60 * 1000),
        submissionFileUrl: 'https://example.com/alice_graded_work.pdf',
      },
    });
  }

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
