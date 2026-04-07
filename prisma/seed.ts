
import { PrismaClient, UserRole, UserStatus, HomeworkType, DeadlineType, QuestionType, SubmissionStatus, SessionStatus, EnrollmentStatus, Subject, Class, RecordingStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Start seeding...');

  // Clean up existing data in correct order
  await prisma.notification.deleteMany();
  await prisma.recording.deleteMany();
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
  const adminUser = await prisma.user.create({
    data: {
      email: 'admin@mrg-lms.com',
      passwordHash,
      firstName: 'Super',
      lastName: 'Admin',
      status: UserStatus.ACTIVE,
      userType: UserRole.ADMIN,
    },
  });

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

  // 2. Create Student: Alice Johnson
  const studentUser = await prisma.user.create({
    data: {
      email: 'alice.johnson@example.com',
      passwordHash,
      firstName: 'Alice',
      lastName: 'Johnson',
      status: UserStatus.ACTIVE,
      userType: UserRole.STUDENT,
      studentProfile: {
        create: { grade: 'Grade 12' },
      },
    },
    include: { studentProfile: true },
  });

  // 2b. Create additional students (for rating likes)
  const studentUser2 = await prisma.user.create({
    data: {
      email: 'bob.martin@example.com',
      passwordHash,
      firstName: 'Bob',
      lastName: 'Martin',
      status: UserStatus.ACTIVE,
      userType: UserRole.STUDENT,
      studentProfile: { create: { grade: 'Grade 11' } },
    },
    include: { studentProfile: true },
  });

  const studentUser3 = await prisma.user.create({
    data: {
      email: 'carol.white@example.com',
      passwordHash,
      firstName: 'Carol',
      lastName: 'White',
      status: UserStatus.ACTIVE,
      userType: UserRole.STUDENT,
      studentProfile: { create: { grade: 'Grade 12' } },
    },
    include: { studentProfile: true },
  });

  const tutorId = tutorUser.tutorProfile!.id;
  const studentId = studentUser.studentProfile!.id;
  const bobId = studentUser2.studentProfile!.id;
  const carolId = studentUser3.studentProfile!.id;

  // 3. Create 10 Subjects
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
      data: { name: s.name, code: s.code, description: s.desc },
    });
    subjects.push(subject);
  }

  // 4. Create 10 Classes
  // schedules: array of { day, startTime, duration } entries for each class
  const classData = [
    {
      name: 'Advanced Calculus BC', fee: 150.0,
      schedules: [
        { day: 'MONDAY', startTime: '14:00', duration: 90 },
        { day: 'THURSDAY', startTime: '14:00', duration: 90 },
      ],
    },
    {
      name: 'Quantum Mechanics Intro', fee: 180.0,
      schedules: [
        { day: 'TUESDAY', startTime: '10:00', duration: 90 },
        { day: 'FRIDAY', startTime: '10:00', duration: 90 },
      ],
    },
    {
      name: 'Organic Chemistry Lab', fee: 160.0,
      schedules: [
        { day: 'WEDNESDAY', startTime: '13:00', duration: 120 },
        { day: 'SATURDAY', startTime: '09:00', duration: 120 },
      ],
    },
    {
      name: 'Molecular Genetics', fee: 140.0,
      schedules: [
        { day: 'MONDAY', startTime: '16:00', duration: 90 },
        { day: 'WEDNESDAY', startTime: '16:00', duration: 90 },
      ],
    },
    {
      name: 'The Industrial Revolution', fee: 120.0,
      schedules: [
        { day: 'TUESDAY', startTime: '15:00', duration: 60 },
      ],
    },
    {
      name: 'Climate Change Analytics', fee: 130.0,
      schedules: [
        { day: 'THURSDAY', startTime: '11:00', duration: 60 },
      ],
    },
    {
      name: 'Shakespearean Drama', fee: 110.0,
      schedules: [
        { day: 'FRIDAY', startTime: '14:00', duration: 90 },
        { day: 'SUNDAY', startTime: '10:00', duration: 90 },
      ],
    },
    {
      name: 'Full-stack Web Dev (React/Nest)', fee: 200.0,
      schedules: [
        { day: 'SATURDAY', startTime: '10:00', duration: 120 },
        { day: 'SUNDAY', startTime: '14:00', duration: 120 },
      ],
    },
    {
      name: 'International Trade Policy', fee: 140.0,
      schedules: [
        { day: 'WEDNESDAY', startTime: '09:00', duration: 90 },
      ],
    },
    {
      name: 'Modern Digital Painting', fee: 120.0,
      schedules: [
        { day: 'SATURDAY', startTime: '15:00', duration: 90 },
      ],
    },
  ];

  const classes: Class[] = [];
  for (let i = 0; i < 10; i++) {
    const cd = classData[i];
    const classItem = await prisma.class.create({
      data: {
        name: cd.name,
        subjectId: subjects[i].id,
        tutorId: tutorId,
        grade: 'Grade 12',
        isActive: true,
        classFee: cd.fee,
        maxStudentCount: 25,
        frequency: cd.schedules.length,
      },
    });
    classes.push(classItem);

    // Create schedule entries for this class
    for (const sched of cd.schedules) {
      await prisma.classSchedule.create({
        data: {
          classId: classItem.id,
          day: sched.day as any,
          startTime: sched.startTime,
          duration: sched.duration,
        },
      });
    }
  }
  console.log('Class schedules seeded.');


  // 5. Enroll Alice in all classes
  const aliceEnrolled = classes.slice(0, 10);
  for (const c of aliceEnrolled) {
    await prisma.enrollment.create({
      data: {
        studentId: studentId,
        classId: c.id,
        assignedPrice: c.classFee,
        status: EnrollmentStatus.ACTIVE,
      },
    });
  }

  const bobEnrolled = classes.slice(2, 5);
  for (const c of bobEnrolled) {
    await prisma.enrollment.create({
      data: {
        studentId: bobId,
        classId: c.id,
        assignedPrice: c.classFee,
        status: EnrollmentStatus.ACTIVE,
      },
    });
  }

  const carolEnrolled = classes.slice(4, 7);
  for (const c of carolEnrolled) {
    await prisma.enrollment.create({
      data: {
        studentId: carolId,
        classId: c.id,
        assignedPrice: c.classFee,
        status: EnrollmentStatus.ACTIVE,
      },
    });
  }

  // 6. Sessions for each class
  const today = new Date();
  today.setHours(16, 0, 0, 0); // 4 PM today

  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay());

  const nextWeek = new Date(today);
  nextWeek.setDate(today.getDate() + 7);

  for (let i = 0; i < 10; i++) {
    const classItem = classes[i];
    let status: SessionStatus = SessionStatus.SCHEDULED;
    let dateTime = new Date(today);
    let link = `https://meet.google.com/class-${i}-session-1`;
    let reason: string | null = null;

    if (i === 0) {
      status = SessionStatus.ONGOING;
      dateTime.setHours(today.getHours() - 1);
    } else if (i === 1 || i === 5 || i === 8) {
      status = SessionStatus.COMPLETED;
      dateTime.setDate(today.getDate() - 1 - (i % 3));
    } else if (i === 2) {
      status = SessionStatus.CANCELLED;
      reason = 'Tutor unavailable due to medical emergency.';
    } else if (i === 3) {
      status = SessionStatus.RESCHEDULED;
      dateTime.setDate(today.getDate() - 2);
      reason = 'Internet outage in the area.';
    } else {
      dateTime = new Date(startOfWeek);
      dateTime.setDate(startOfWeek.getDate() + (i % 6) + 1);
      dateTime.setHours(10 + (i % 5), 0, 0, 0);
    }

    const session1 = await prisma.session.create({
      data: {
        classId: classItem.id,
        dateTime,
        duration: 90,
        status,
        link,
        cancellationReason: reason,
      },
    });

    const nextWeekDate = new Date(nextWeek);
    nextWeekDate.setDate(nextWeek.getDate() + (i % 7));
    nextWeekDate.setHours(11 + (i % 4), 30, 0, 0);

    const session2 = await prisma.session.create({
      data: {
        classId: classItem.id,
        dateTime: nextWeekDate,
        duration: 90,
        status: SessionStatus.SCHEDULED,
        link: `https://meet.google.com/class-${i}-next-week`,
      },
    });

    if (status === SessionStatus.RESCHEDULED) {
      await prisma.session.update({
        where: { id: session1.id },
        data: { rescheduledSessionId: session2.id },
      });
    }

    // Create a recording for completed sessions
    if (status === SessionStatus.COMPLETED) {
      // Create some variations for testing statuses
      let recordingStatus = RecordingStatus.AVAILABLE;
      let expiresAt = new Date(today);

      if (i === 1) { // Second class (Quantum Mechanics)
        recordingStatus = RecordingStatus.AVAILABLE;
        expiresAt.setDate(today.getDate() + 10);
      } else if (i === 5) { // Sixth class (Climate Change)
        recordingStatus = RecordingStatus.EXPIRING_SOON;
        expiresAt.setDate(today.getDate() + 2);
      } else if (i === 8) { // Ninth class (International Trade)
        recordingStatus = RecordingStatus.EXPIRED;
        expiresAt.setDate(today.getDate() - 2);
      }

      await prisma.recording.create({
        data: {
          sessionId: session1.id,
          classId: classItem.id,
          videoUrl: `https://recorded-session-${session1.id}`,
          duration: '1h 15m',
          fileSize: '520 MB',
          status: recordingStatus,
          expiresAt: expiresAt,
          viewCount: Math.floor(Math.random() * 50),
        },
      });
    }
  }
  console.log('Recordings seeded.');

  // 7. Homeworks for each class
  const allHomeworks: any[] = [];
  const hwQuestions = [
    { text: 'Is the derivative of e^x equal to e^x?', type: QuestionType.TRUE_FALSE, ans: 'TRUE' },
    { text: 'Solve for x: 2x + 5 = 15', type: QuestionType.SHORT, ans: '5' },
    { text: 'Is light both a particle and a wave?', type: QuestionType.TRUE_FALSE, ans: 'TRUE' },
    { text: 'What is the chemical symbol for Gold?', type: QuestionType.SHORT, ans: 'Au' },
  ];

  for (let i = 0; i < 10; i++) {
    const classItem = classes[i];

    const quizHomework = await prisma.homework.create({
      data: {
        classId: classItem.id,
        title: `${classItem.name} Weekly Quiz`,
        description: `Review quiz for ${classItem.name} topics.`,
        type: HomeworkType.QUIZ,
        totalMarks: 20,
        deadlineType: DeadlineType.FIXED_DATE,
        deadlineDate: new Date(today.getTime() + 5 * 24 * 60 * 60 * 1000),
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

    const fileHomework = await prisma.homework.create({
      data: {
        classId: classItem.id,
        title: `${classItem.name} Main Project`,
        description: `Deep dive project for ${classItem.name}. Submit as PDF.`,
        type: HomeworkType.FILE,
        fileUrl: 'https://mrg-lms-assets.s3.amazonaws.com/templates/project_brief.pdf',
        totalMarks: 100,
        deadlineType: DeadlineType.FIXED_DATE,
        deadlineDate: new Date(today.getTime() + 12 * 24 * 60 * 60 * 1000),
      },
    });
    allHomeworks.push(fileHomework);
  }

  // 8. Submissions
  // Alice: 1 ungraded Quiz, 1 ungraded File
  await prisma.homeworkSubmission.create({
    data: {
      homeworkId: allHomeworks[0].id, // Quiz
      studentId: studentId,
      status: SubmissionStatus.SUBMITTED,
      submittedAt: new Date(today.getTime() - 2 * 60 * 60 * 1000),
      answers: {
        create: allHomeworks[0].questions.map((q: any) => ({
          questionId: q.id,
          answerText: q.correctAnswer, // Alice got them right
        })),
      },
    },
  });

  await prisma.homeworkSubmission.create({
    data: {
      homeworkId: allHomeworks[1].id, // File
      studentId: studentId,
      status: SubmissionStatus.SUBMITTED,
      submittedAt: new Date(today.getTime() - 1 * 60 * 60 * 1000),
      submissionFileUrl: 'https://example.com/alice_project.pdf',
    },
  });

  // Bob: 1 ungraded Quiz (Submitted), 1 ungraded File (Late)
  await prisma.homeworkSubmission.create({
    data: {
      homeworkId: allHomeworks[4].id, // Quiz in class 2
      studentId: bobId,
      status: SubmissionStatus.SUBMITTED,
      submittedAt: new Date(today.getTime() - 4 * 60 * 60 * 1000),
      answers: {
        create: [
          { questionId: allHomeworks[4].questions[0].id, answerText: 'Partial Answer' },
          { questionId: allHomeworks[4].questions[1].id, answerText: 'TRUE' }, // Wrong!
        ],
      },
    },
  });

  const lateDate = new Date(today);
  lateDate.setDate(today.getDate() - 5);
  const lateHw = await prisma.homework.create({
    data: {
      classId: classes[0].id,
      title: 'Mandatory Calculus Review (Overdue)',
      description: 'Submission for the late homework review task.',
      type: HomeworkType.FILE,
      totalMarks: 100,
      deadlineType: DeadlineType.FIXED_DATE,
      deadlineDate: lateDate,
    },
  });

  await prisma.homeworkSubmission.create({
    data: {
      homeworkId: lateHw.id,
      studentId: bobId,
      status: SubmissionStatus.LATE,
      submittedAt: new Date(),
      submissionFileUrl: 'https://example.com/bob_late_work.pdf',
    },
  });

  // Carol: 1 ungraded Quiz (Late)
  await prisma.homeworkSubmission.create({
    data: {
      homeworkId: allHomeworks[8].id, // Quiz in class 4
      studentId: carolId,
      status: SubmissionStatus.LATE,
      submittedAt: new Date(),
      answers: {
        create: allHomeworks[8].questions.map((q: any) => ({
          questionId: q.id,
          answerText: 'I guessed',
        })),
      },
    },
  });

  for (let i = 0; i < 2; i++) {
    const hwIndex = (i + 1) * 2;
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

  for (let i = 0; i < 2; i++) {
    const hwIndex = (i + 1) * 2 + 1;
    const hw = allHomeworks[hwIndex];
    await prisma.homeworkSubmission.create({
      data: {
        homeworkId: hw.id,
        studentId: studentId,
        status: SubmissionStatus.GRADED,
        totalMarksAwarded: 92 + i * 3,
        feedback: 'Very thorough research and professional presentation.',
        submittedAt: new Date(today.getTime() - 4 * 24 * 60 * 60 * 1000),
        submissionFileUrl: `https://mrg-lms-assets.s3.amazonaws.com/submissions/student_${studentId}_hw_${hw.id}_final.pdf`,
      },
    });
  }

  // 8b. Additional submissions for Robert Smith's classes
  console.log('Seeding additional submissions for Robert Smith...');

  // Bob: Graded Quiz in Class 3
  await prisma.homeworkSubmission.create({
    data: {
      homeworkId: allHomeworks[6].id, // Class 3 Quiz
      studentId: bobId,
      status: SubmissionStatus.GRADED,
      totalMarksAwarded: 18,
      feedback: 'Good job on the short answer part.',
      submittedAt: new Date(today.getTime() - 1 * 24 * 60 * 60 * 1000),
      answers: {
        create: [
          {
            questionId: allHomeworks[6].questions[0].id,
            answerText: allHomeworks[6].questions[0].correctAnswer,
            marksAwarded: 10,
          },
          {
            questionId: allHomeworks[6].questions[1].id,
            answerText: allHomeworks[6].questions[1].correctAnswer,
            marksAwarded: 8,
          },
        ],
      },
    },
  });

  // Bob: Ungraded File in Class 3
  await prisma.homeworkSubmission.create({
    data: {
      homeworkId: allHomeworks[7].id, // Class 3 File
      studentId: bobId,
      status: SubmissionStatus.SUBMITTED,
      submittedAt: new Date(today.getTime() - 12 * 60 * 60 * 1000),
      submissionFileUrl: 'https://example.com/bob_class3_project.pdf',
    },
  });

  // Carol: Graded Quiz in Class 5
  await prisma.homeworkSubmission.create({
    data: {
      homeworkId: allHomeworks[10].id, // Class 5 Quiz
      studentId: carolId,
      status: SubmissionStatus.GRADED,
      totalMarksAwarded: 15,
      feedback: 'Well done, though you missed one logic point.',
      submittedAt: new Date(today.getTime() - 2 * 24 * 60 * 60 * 1000),
      answers: {
        create: [
          {
            questionId: allHomeworks[10].questions[0].id,
            answerText: allHomeworks[10].questions[0].correctAnswer,
            marksAwarded: 10,
          },
          {
            questionId: allHomeworks[10].questions[1].id,
            answerText: 'TRUE',
            marksAwarded: 5,
          },
        ],
      },
    },
  });

  // Carol: Ungraded File in Class 5
  await prisma.homeworkSubmission.create({
    data: {
      homeworkId: allHomeworks[11].id, // Class 5 File
      studentId: carolId,
      status: SubmissionStatus.SUBMITTED,
      submittedAt: new Date(today.getTime() - 18 * 60 * 60 * 1000),
      submissionFileUrl: 'https://example.com/carol_class5_project.pdf',
    },
  });

  // Carol: Ungraded Quiz in Class 6
  await prisma.homeworkSubmission.create({
    data: {
      homeworkId: allHomeworks[12].id, // Class 6 Quiz
      studentId: carolId,
      status: SubmissionStatus.SUBMITTED,
      submittedAt: new Date(today.getTime() - 6 * 60 * 60 * 1000),
      answers: {
        create: allHomeworks[12].questions.map((q: any) => ({
          questionId: q.id,
          answerText: q.correctAnswer,
        })),
      },
    },
  });

  // Carol: Graded File in Class 6
  await prisma.homeworkSubmission.create({
    data: {
      homeworkId: allHomeworks[13].id, // Class 6 File
      studentId: carolId,
      status: SubmissionStatus.GRADED,
      totalMarksAwarded: 88,
      feedback: 'Solid work. See my annotations for minor improvements.',
      submittedAt: new Date(today.getTime() - 3 * 24 * 60 * 60 * 1000),
      submissionFileUrl: 'https://example.com/carol_class6_project_v2.pdf',
    },
  });

  // 9. Ratings & Likes for Dr. Robert Smith
  console.log('Seeding ratings and likes...');

  const ratingsData = [
    {
      overallRating: 5.0,
      teachingQuality: 5,
      communication: 5,
      punctuality: 5,
      review: 'Dr. Smith is an exceptional teacher. His clarity on complex physics topics is truly unmatched!',
    },
    {
      overallRating: 4.5,
      teachingQuality: 5,
      communication: 4,
      punctuality: 5,
      review: 'Very professional and always on time. Helped me improve my calculus grades significantly.',
    },
    {
      overallRating: 5.0,
      teachingQuality: 5,
      communication: 5,
      punctuality: 5,
      review: "Absolutely the best! Made organic chemistry actually fun to learn. Never thought I'd enjoy it.",
    },
  ];

  const createdRatings: any[] = [];
  let totalOverall = 0;

  for (let i = 0; i < ratingsData.length; i++) {
    const data = ratingsData[i];
    // Alternate between students for ratings
    const studentUsers = [studentUser, studentUser2, studentUser3];
    const postingUser = studentUsers[i % studentUsers.length];

    const rating = await prisma.rating.create({
      data: {
        tutorId,
        userId: postingUser.id,
        ...data
      },
    });
    createdRatings.push(rating);
    totalOverall += data.overallRating;
  }

  // Update tutor average rating and total reviews
  await prisma.tutor.update({
    where: { id: tutorId },
    data: {
      averageRating: totalOverall / ratingsData.length,
      totalReviews: ratingsData.length,
    },
  });

  // Add likes:
  // Alice  → ratings 0, 1
  // Bob    → ratings 0, 2
  // Carol  → ratings 1, 2
  const likeMap: { userId: number; ratingIndex: number }[] = [
    { userId: studentUser.id, ratingIndex: 0 },
    { userId: studentUser.id, ratingIndex: 1 },
    { userId: studentUser2.id, ratingIndex: 0 },
    { userId: studentUser2.id, ratingIndex: 2 },
    { userId: studentUser3.id, ratingIndex: 1 },
    { userId: studentUser3.id, ratingIndex: 2 },
  ];

  for (const { userId, ratingIndex } of likeMap) {
    await prisma.ratingLike.create({
      data: { userId, ratingId: createdRatings[ratingIndex].id },
    });
  }

  // Update each rating's likes count
  const likeCountMap: Record<number, number> = {};
  for (const { ratingIndex } of likeMap) {
    likeCountMap[ratingIndex] = (likeCountMap[ratingIndex] || 0) + 1;
  }
  for (const [ratingIndex, count] of Object.entries(likeCountMap)) {
    await prisma.rating.update({
      where: { id: createdRatings[Number(ratingIndex)].id },
      data: { likes: count },
    });
  }

  // 10. Availability Seeding
  // Goal: give each tutor/student 3 broad windows across different days,
  // with deliberate overlaps so an admin can assign a class and watch
  // the interval-subtraction logic split / trim / delete availability entries.
  //
  // Overlap map (what a freshly assigned class could be):
  //   MONDAY    14:00 – 16:00  →  tutor 14:00-18:00  overlaps  alice 14:00-17:00
  //   WEDNESDAY 10:00 – 11:30  →  tutor 09:00-12:00  overlaps  bob   09:30-13:00
  //   FRIDAY    15:00 – 16:30  →  tutor 13:00-17:00  overlaps  carol 14:00-18:00
  console.log('Seeding availability...');
  const { WeekDay } = require('@prisma/client');

  // ── Tutor Availability (Robert) ──────────────────────────────────────────
  await prisma.tutorAvailability.createMany({
    data: [
      // Monday  14:00 – 18:00  (overlaps Alice 14:00-17:00)
      { tutorId, day: WeekDay.MONDAY, startTime: '14:00', endTime: '18:00' },
      // Wednesday 09:00 – 12:00  (overlaps Bob 09:30-13:00)
      { tutorId, day: WeekDay.WEDNESDAY, startTime: '09:00', endTime: '12:00' },
      // Friday  13:00 – 17:00  (overlaps Carol 14:00-18:00)
      { tutorId, day: WeekDay.FRIDAY, startTime: '13:00', endTime: '17:00' },
    ],
  });

  // ── Alice (Student 1) ────────────────────────────────────────────────────
  await prisma.studentAvailability.createMany({
    data: [
      // Monday  14:00 – 17:00  (overlaps tutor 14:00-18:00  ✓)
      { studentId, day: WeekDay.MONDAY, startTime: '14:00', endTime: '17:00' },
      // Thursday  10:00 – 12:30
      { studentId, day: WeekDay.THURSDAY, startTime: '10:00', endTime: '12:30' },
      // Saturday  09:00 – 11:00
      { studentId, day: WeekDay.SATURDAY, startTime: '09:00', endTime: '11:00' },
    ],
  });

  // ── Bob (Student 2) ──────────────────────────────────────────────────────
  await prisma.studentAvailability.createMany({
    data: [
      // Wednesday  09:30 – 13:00  (overlaps tutor 09:00-12:00  ✓)
      { studentId: bobId, day: WeekDay.WEDNESDAY, startTime: '09:30', endTime: '13:00' },
      // Monday  16:00 – 18:30
      { studentId: bobId, day: WeekDay.MONDAY, startTime: '16:00', endTime: '18:30' },
      // Friday  10:00 – 13:00
      { studentId: bobId, day: WeekDay.FRIDAY, startTime: '10:00', endTime: '13:00' },
    ],
  });

  // ── Carol (Student 3) ────────────────────────────────────────────────────
  await prisma.studentAvailability.createMany({
    data: [
      // Friday  14:00 – 18:00  (overlaps tutor 13:00-17:00  ✓)
      { studentId: carolId, day: WeekDay.FRIDAY, startTime: '14:00', endTime: '18:00' },
      // Tuesday  09:00 – 11:00
      { studentId: carolId, day: WeekDay.TUESDAY, startTime: '09:00', endTime: '11:00' },
      // Saturday  13:00 – 16:00
      { studentId: carolId, day: WeekDay.SATURDAY, startTime: '13:00', endTime: '16:00' },
    ],
  });

  // 11. Notification Seeding
  console.log('Seeding notifications...');
  const { NotificationType } = require('@prisma/client');

  const notifications = [
    // Alice (Student)
    {
      userId: studentUser.id,
      title: 'New Class Scheduled',
      message: 'Your Mathematics class has been scheduled for tomorrow at 10:00 AM.',
      type: NotificationType.CLASS,
    },
    {
      userId: studentUser.id,
      title: 'Homework Assigned',
      message: 'A new homework "Calculus Worksheet 1" has been assigned.',
      type: NotificationType.HOMEWORK,
    },
    // Bob (Student)
    {
      userId: studentUser2.id,
      title: 'Payment Received',
      message: 'Your payment for the month of March has been processed.',
      type: NotificationType.PAYMENT,
    },
    {
      userId: studentUser2.id,
      title: 'Reschedule Update',
      message: 'Your request to reschedule Chemistry has been accepted.',
      type: NotificationType.RESCHEDULE,
    },
    // Robert (Tutor)
    {
      userId: tutorUser.id,
      title: 'New Student Enrolled',
      message: 'Alice Johnson has joined your Mathematics class.',
      type: NotificationType.ENROLLMENT,
    },
    {
      userId: tutorUser.id,
      title: 'Reschedule Requested',
      message: 'Bob Martin has requested to reschedule the Physics session.',
      type: NotificationType.RESCHEDULE,
    },
    // Admin
    {
      userId: adminUser.id,
      title: 'System Alert',
      message: 'Server maintenance scheduled for Sunday at 2:00 AM.',
      type: NotificationType.SYSTEM,
    },
    {
      userId: adminUser.id,
      title: 'New Tutor Application',
      message: 'A new tutor application is pending your review.',
      type: NotificationType.ENROLLMENT,
    }
  ];

  await prisma.notification.createMany({
    data: notifications,
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
