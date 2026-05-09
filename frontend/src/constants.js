export const API_URL = 'http://localhost:3001/api';

export const CATEGORY_NAMES = {
  syllabus:     'Syllabus',
  courseGuide:  'Course Guide',
  slm:          'SLM',
  communityImmersion: 'Number of subject areas with community immersion/involvement component',
  gradingSheet: 'Grading Sheet',
  tos:          'TOS',
  attendanceSheet: 'Attendance Sheet',
  classRecord: 'Class Records',
  evaluationOfTeachingEffectiveness: 'Evaluation of Teaching Effectiveness',
  classroomObservation: 'Classroom Observation',
  testQuestions: 'Test Questions',
  answerKeys: 'Answer Keys',
  facultyAndStudentsSeekAdvices: 'Faculty and Students Seek Advices',
  accomplishmentReport: 'Accomplishment Report (Instruction)',
  randdProposal: 'R&D Proposal',
  researchImplemented: 'Research Implemented',
  researchPresented: 'Research Presented',
  researchPublished: 'Research Published',
  intellectualPropertyRights: 'Intellectual Property Rights',
  researchUtilizedDeveloped: 'Research Utilized/Developed',
  numberOfCitations: 'Number of Citations',
  extentionProposal: 'Extension Proposal',
  personsTrained: 'Persons Trained',
  personServiceRating: 'Person Service Rating',
  personGivenTraining: 'Person Given Training',
  technicalAdvice: 'Technical Advice',
  attendanceFlagCeremony: 'Attendance Flag Ceremony',
  attendanceFlagLowering: 'Attendance Flag Lowering',
  attendanceHealthAndWellnessProgram: 'Attendance Health and Wellness Program',
  attendanceSchoolCelebrations: 'Attendance School Celebrations',
  trainingSeminarConferenceCertificate: 'Training/Seminar/Conference Certificate',
  atttendanceFacultyMeeting: 'Attendance Faculty Meeting',
  attendanceISOAndRelatedActivities: 'Attendance ISO and Related Activities',
  attendaceSpiritualActivities: 'Attendance Spiritual Activities',
};



export const CATEGORY_GROUPS = {
  instruction: [
    'syllabus', 'courseGuide', 'slm', 'communityImmersion', 'gradingSheet', 'tos', 'attendanceSheet', 'classRecord',
    'evaluationOfTeachingEffectiveness', 'classroomObservation', 'testQuestions', 'answerKeys',
    'facultyAndStudentsSeekAdvices', 'accomplishmentReport'
  ],
  research: [
    'randdProposal', 'researchImplemented', 'researchPresented', 'researchPublished',
    'intellectualPropertyRights', 'researchUtilizedDeveloped', 'numberOfCitations'
  ],
  extension: [
    'extentionProposal', 'personsTrained', 'personServiceRating', 'personGivenTraining', 'technicalAdvice'
  ],
  supportFunction: [
    'attendanceFlagCeremony', 'attendanceFlagLowering', 'attendanceHealthAndWellnessProgram',
    'attendanceSchoolCelebrations', 'trainingSeminarConferenceCertificate', 'atttendanceFacultyMeeting',
    'attendanceISOAndRelatedActivities', 'attendaceSpiritualActivities'
  ]
};

export const GROUP_NAMES = {
  instruction: 'Instruction',
  research: 'Research',
  extension: 'Extension',
  supportFunction: 'Support Function'
};

export const AUTOMATED_CATEGORIES = [
  "Accomplishment Report (Instruction)",
  "Attendance Sheet",
  "Class Records",
  "Classroom Observation",
  "Course Guide",
  "Evaluation of Teaching Effectiveness",
  "Grading Sheet",
  "Research Implemented",
  "SLM",
  "Syllabus",
  "Test Questions",
  "TOS"
];
