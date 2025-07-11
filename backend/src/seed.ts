import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Physician } from './entities/physician.entity';
import { Patient } from './entities/patient.entity';
import { Appointment } from './entities/appointment.entity';
import { AvailabilityBlock } from './entities/availability-block.entity';
import { BillingRule } from './entities/billing-rule.entity';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const physicianRepo = app.get(getRepositoryToken(Physician));
  const patientRepo = app.get(getRepositoryToken(Patient));
  const appointmentRepo = app.get(getRepositoryToken(Appointment));
  const availabilityBlockRepo = app.get(getRepositoryToken(AvailabilityBlock));
  const billingRuleRepo = app.get(getRepositoryToken(BillingRule));

  await appointmentRepo.createQueryBuilder().delete().execute();
  await availabilityBlockRepo.createQueryBuilder().delete().execute();
  await billingRuleRepo.createQueryBuilder().delete().execute();
  await physicianRepo.createQueryBuilder().delete().execute();
  await patientRepo.createQueryBuilder().delete().execute();

  const physician1 = await physicianRepo.save({
    code: 'p001',
    name: 'Dr. John Smith',
    specialty: 'Family Medicine',
    clinicId: 'c001',
    workingHours: {
      tue: ['09:00', '17:00'],
      wed: ['09:00', '17:00'],
      thu: ['09:00', '17:00'],
      fri: ['09:00', '17:00'],
    },
  });
  const physician2 = await physicianRepo.save({
    code: 'p002',
    name: 'Dr. Priya Patel',
    specialty: 'Pediatrics',
    clinicId: 'c002',
    workingHours: {
      tue: ['09:00', '12:00'],
      wed: ['09:00', '12:00'],
      thu: ['09:00', '12:00'],
      fri: ['09:00', '12:00'],
    },
  });
  const physician3 = await physicianRepo.save({
    code: 'p003',
    name: 'Dr. Alice Lee',
    specialty: 'Dermatology',
    clinicId: 'c003',
    workingHours: {
      wed: ['13:00', '17:00'],
      thu: ['13:00', '17:00'],
      fri: ['13:00', '17:00'],
    },
  });
  const physician4 = await physicianRepo.save({
    code: 'p004',
    name: 'Dr. Omar Hassan',
    specialty: 'Cardiology',
    clinicId: 'c004',
    workingHours: {
      tue: ['08:00', '12:00'],
      wed: ['08:00', '12:00'],
      thu: ['08:00', '12:00'],
    },
  });

  const patient1 = await patientRepo.save({
    code: 'u123',
    name: 'Jane Doe',
  });
  const patient2 = await patientRepo.save({
    code: 'u456',
    name: 'Alex Kim',
  });
  const patient3 = await patientRepo.save({
    code: 'u789',
    name: 'Maria Lopez',
  });
  const patient4 = await patientRepo.save({
    code: 'u321',
    name: 'Ben Carter',
  });

  await availabilityBlockRepo.save({
    physician: physician1,
    clinicId: 'c001',
    startTime: new Date('2025-07-10T09:00:00'),
    endTime: new Date('2025-07-10T17:00:00'),
    type: 'available',
  });
  await availabilityBlockRepo.save({
    physician: physician2,
    clinicId: 'c002',
    startTime: new Date('2025-07-10T09:00:00'),
    endTime: new Date('2025-07-10T12:00:00'),
    type: 'available',
  });
  await availabilityBlockRepo.save({
    physician: physician3,
    clinicId: 'c003',
    startTime: new Date('2025-07-10T13:00:00'),
    endTime: new Date('2025-07-10T17:00:00'),
    type: 'available',
  });
  await availabilityBlockRepo.save({
    physician: physician4,
    clinicId: 'c004',
    startTime: new Date('2025-07-10T08:00:00'),
    endTime: new Date('2025-07-10T12:00:00'),
    type: 'available',
  });

  await appointmentRepo.save({
    clinicId: 'c001',
    physician: physician1,
    patient: patient1,
    startTime: new Date('2025-07-10T10:00:00'),
    endTime: new Date('2025-07-10T10:30:00'),
    status: 'booked',
  });
  await appointmentRepo.save({
    clinicId: 'c002',
    physician: physician2,
    patient: patient2,
    startTime: new Date('2025-07-10T10:30:00'),
    endTime: new Date('2025-07-10T11:00:00'),
    status: 'booked',
  });
  await appointmentRepo.save({
    clinicId: 'c003',
    physician: physician3,
    patient: patient3,
    startTime: new Date('2025-07-10T15:00:00'),
    endTime: new Date('2025-07-10T15:30:00'),
    status: 'booked',
  });
  await appointmentRepo.save({
    clinicId: 'c004',
    physician: physician4,
    patient: patient4,
    startTime: new Date('2025-07-10T09:00:00'),
    endTime: new Date('2025-07-10T09:30:00'),
    status: 'booked',
  });

  await billingRuleRepo.save({
    region: 'Ontario',
    gapDurationMinutes: 15,
    beforeAppointmentBuffer: 0,
    afterAppointmentBuffer: 0,
  });

  await app.close();
}

bootstrap();
