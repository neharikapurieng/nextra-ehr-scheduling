import { Test, TestingModule } from '@nestjs/testing';
import { AppointmentsService } from './appointments.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Physician } from '../entities/physician.entity';
import { Appointment } from '../entities/appointment.entity';
import { AvailabilityBlock } from '../entities/availability-block.entity';
import { BillingRule } from '../entities/billing-rule.entity';

const mockPhysicianRepo = {
  findOne: jest.fn(),
};
const mockAppointmentRepo = {
  find: jest.fn(),
};
const mockAvailabilityBlockRepo = {
  find: jest.fn(),
};
const mockBillingRuleRepo = {
  findOne: jest.fn(),
};

describe('AppointmentsService', () => {
  let service: AppointmentsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppointmentsService,
        { provide: getRepositoryToken(Physician), useValue: mockPhysicianRepo },
        { provide: getRepositoryToken(Appointment), useValue: mockAppointmentRepo },
        { provide: getRepositoryToken(AvailabilityBlock), useValue: mockAvailabilityBlockRepo },
        { provide: getRepositoryToken(BillingRule), useValue: mockBillingRuleRepo },
      ],
    }).compile();

    service = module.get<AppointmentsService>(AppointmentsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should return error if physician not found', async () => {
    mockPhysicianRepo.findOne.mockResolvedValue(null);
    await expect(service.recommendSlots({
      clinicId: 'c1',
      physicianId: 'p001',
      patientId: 'u123',
      preferredDate: '2025-07-10',
      durationMinutes: 30,
    })).rejects.toThrow('Physician not found');
  });

  it('should recommend slots (unit, happy path)', async () => {
    mockPhysicianRepo.findOne.mockResolvedValue({
      id: 'phys-uuid',
      code: 'p001',
      clinicId: 'c1',
      workingHours: { wed: ['09:00', '17:00'] },
    });
    mockAppointmentRepo.find.mockResolvedValue([]);
    mockAvailabilityBlockRepo.find.mockResolvedValue([
      { type: 'available', startTime: new Date('2025-07-09T09:00:00'), endTime: new Date('2025-07-09T17:00:00') },
    ]);
    mockBillingRuleRepo.findOne.mockResolvedValue({ gapDurationMinutes: 15, beforeAppointmentBuffer: 0, afterAppointmentBuffer: 0 });

    const result = await service.recommendSlots({
      clinicId: 'c1',
      physicianId: 'p001',
      patientId: 'u123',
      preferredDate: '2025-07-09',
      durationMinutes: 30,
    });
    expect(result).toBeDefined();
    expect(result!.status).toBe('success');
    expect(result!.recommendedSlots.length).toBeGreaterThan(0);
  });

  it('should avoid clustering and prefer least disruptive slots', async () => {
    mockPhysicianRepo.findOne.mockResolvedValue({
      id: 'phys-uuid',
      code: 'p001',
      clinicId: 'c1',
      workingHours: { wed: ['09:00', '12:00'] },
    });
    const appointments = [
      { startTime: new Date('2025-07-09T09:30:00'), endTime: new Date('2025-07-09T10:00:00') },
      { startTime: new Date('2025-07-09T11:00:00'), endTime: new Date('2025-07-09T11:30:00') },
    ];
    mockAppointmentRepo.find.mockResolvedValue(appointments);
    mockAvailabilityBlockRepo.find.mockResolvedValue([
      { type: 'available', startTime: new Date('2025-07-09T09:00:00'), endTime: new Date('2025-07-09T12:00:00') },
    ]);
    mockBillingRuleRepo.findOne.mockResolvedValue({ gapDurationMinutes: 15, beforeAppointmentBuffer: 0, afterAppointmentBuffer: 0 });

    const result = await service.recommendSlots({
      clinicId: 'c1',
      physicianId: 'p001',
      patientId: 'u123',
      preferredDate: '2025-07-09',
      durationMinutes: 30,
    });

    const gap = 15 * 60 * 1000;
    for (const slot of result!.recommendedSlots) {
      const slotStart = new Date(slot);
      const slotEnd = new Date(slotStart.getTime() + 30 * 60 * 1000);
      for (const app of appointments) {
        expect(Math.abs(slotStart.getTime() - app.endTime.getTime())).toBeGreaterThanOrEqual(gap);
        expect(Math.abs(slotEnd.getTime() - app.startTime.getTime())).toBeGreaterThanOrEqual(gap);
      }
    }
  });

  it('should recommend slots for multiple clinics and providers', async () => {
    const physicians = [
      { id: 'phys-1', code: 'smith', clinicId: 'clinicA', workingHours: { wed: ['09:00', '12:00'] } },
      { id: 'phys-2', code: 'patel', clinicId: 'clinicB', workingHours: { wed: ['09:00', '12:00'] } },
    ];
    mockPhysicianRepo.findOne.mockImplementation(({ where }) => {
      return physicians.find(p => (p.id === where.id || p.code === where.code) && p.clinicId === where.clinicId) || null;
    });
    const appointments = {
      phys1: [
        { startTime: new Date('2025-07-09T09:30:00'), endTime: new Date('2025-07-09T10:00:00') },
      ],
      phys2: [
        { startTime: new Date('2025-07-09T10:30:00'), endTime: new Date('2025-07-09T11:00:00') },
      ],
    };
    mockAppointmentRepo.find.mockImplementation(({ where }) => {
      if (where.physician.id === 'phys-1') return appointments.phys1;
      if (where.physician.id === 'phys-2') return appointments.phys2;
      return [];
    });
    mockAvailabilityBlockRepo.find.mockResolvedValue([
      { type: 'available', startTime: new Date('2025-07-09T09:00:00'), endTime: new Date('2025-07-09T12:00:00') },
    ]);
    mockBillingRuleRepo.findOne.mockResolvedValue({ gapDurationMinutes: 15, beforeAppointmentBuffer: 0, afterAppointmentBuffer: 0 });

    const resultA = await service.recommendSlots({
      clinicId: 'clinicA',
      physicianId: 'smith',
      patientId: 'u123',
      preferredDate: '2025-07-09',
      durationMinutes: 30,
    });
    expect(resultA).toBeDefined();
    const resultB = await service.recommendSlots({
      clinicId: 'clinicB',
      physicianId: 'patel',
      patientId: 'u456',
      preferredDate: '2025-07-09',
      durationMinutes: 30,
    });
    expect(resultB).toBeDefined();

    expect(resultA!.status).toBe('success');
    expect(resultB!.status).toBe('success');
    for (const slot of resultA!.recommendedSlots) {
      const slotStart = new Date(slot);
      const slotEnd = new Date(slotStart.getTime() + 30 * 60 * 1000);
      for (const app of appointments.phys1) {
        expect(Math.abs(slotStart.getTime() - app.endTime.getTime())).toBeGreaterThanOrEqual(15 * 60 * 1000);
        expect(Math.abs(slotEnd.getTime() - app.startTime.getTime())).toBeGreaterThanOrEqual(15 * 60 * 1000);
      }
    }
    for (const slot of resultB!.recommendedSlots) {
      const slotStart = new Date(slot);
      const slotEnd = new Date(slotStart.getTime() + 30 * 60 * 1000);
      for (const app of appointments.phys2) {
        expect(Math.abs(slotStart.getTime() - app.endTime.getTime())).toBeGreaterThanOrEqual(15 * 60 * 1000);
        expect(Math.abs(slotEnd.getTime() - app.startTime.getTime())).toBeGreaterThanOrEqual(15 * 60 * 1000);
      }
    }
  });

  it('should recommend slots for three clinics and three providers with overlapping and non-overlapping times', async () => {
    const physicians = [
      { id: 'phys-1', code: 'smith', clinicId: 'clinicA', workingHours: { wed: ['09:00', '12:00'] } },
      { id: 'phys-2', code: 'patel', clinicId: 'clinicB', workingHours: { wed: ['09:00', '12:00'] } },
      { id: 'phys-3', code: 'lee', clinicId: 'clinicC', workingHours: { wed: ['13:00', '17:00'] } },
    ];
    mockPhysicianRepo.findOne.mockImplementation(({ where }) => {
      return physicians.find(p => (p.id === where.id || p.code === where.code) && p.clinicId === where.clinicId) || null;
    });
    const appointments = {
      phys1: [
        { startTime: new Date('2025-07-09T09:30:00'), endTime: new Date('2025-07-09T10:00:00') },
      ],
      phys2: [
        { startTime: new Date('2025-07-09T10:30:00'), endTime: new Date('2025-07-09T11:00:00') },
      ],
      phys3: [
        { startTime: new Date('2025-07-09T15:00:00'), endTime: new Date('2025-07-09T15:30:00') },
      ],
    };
    mockAppointmentRepo.find.mockImplementation(({ where }) => {
      if (where.physician.id === 'phys-1') return appointments.phys1;
      if (where.physician.id === 'phys-2') return appointments.phys2;
      if (where.physician.id === 'phys-3') return appointments.phys3;
      return [];
    });
    mockAvailabilityBlockRepo.find.mockImplementation(({ where }) => {
      if (where.physician.id === 'phys-1') return [{ type: 'available', startTime: new Date('2025-07-09T09:00:00'), endTime: new Date('2025-07-09T12:00:00') }];
      if (where.physician.id === 'phys-2') return [{ type: 'available', startTime: new Date('2025-07-09T09:00:00'), endTime: new Date('2025-07-09T12:00:00') }];
      if (where.physician.id === 'phys-3') return [{ type: 'available', startTime: new Date('2025-07-09T13:00:00'), endTime: new Date('2025-07-09T17:00:00') }];
      return [];
    });
    mockBillingRuleRepo.findOne.mockResolvedValue({ gapDurationMinutes: 15, beforeAppointmentBuffer: 0, afterAppointmentBuffer: 0 });

    const resultA = await service.recommendSlots({
      clinicId: 'clinicA',
      physicianId: 'smith',
      patientId: 'u123',
      preferredDate: '2025-07-09',
      durationMinutes: 30,
    });
    expect(resultA).toBeDefined();
    const resultB = await service.recommendSlots({
      clinicId: 'clinicB',
      physicianId: 'patel',
      patientId: 'u456',
      preferredDate: '2025-07-09',
      durationMinutes: 30,
    });
    expect(resultB).toBeDefined();
    const resultC = await service.recommendSlots({
      clinicId: 'clinicC',
      physicianId: 'lee',
      patientId: 'u789',
      preferredDate: '2025-07-09',
      durationMinutes: 30,
    });
    expect(resultC).toBeDefined();

    expect(resultA!.status).toBe('success');
    expect(resultB!.status).toBe('success');
    expect(resultC!.status).toBe('success');
    for (const slot of resultA!.recommendedSlots) {
      const slotStart = new Date(slot);
      const slotEnd = new Date(slotStart.getTime() + 30 * 60 * 1000);
      for (const app of appointments.phys1) {
        expect(Math.abs(slotStart.getTime() - app.endTime.getTime())).toBeGreaterThanOrEqual(15 * 60 * 1000);
        expect(Math.abs(slotEnd.getTime() - app.startTime.getTime())).toBeGreaterThanOrEqual(15 * 60 * 1000);
      }
    }
    for (const slot of resultB!.recommendedSlots) {
      const slotStart = new Date(slot);
      const slotEnd = new Date(slotStart.getTime() + 30 * 60 * 1000);
      for (const app of appointments.phys2) {
        expect(Math.abs(slotStart.getTime() - app.endTime.getTime())).toBeGreaterThanOrEqual(15 * 60 * 1000);
        expect(Math.abs(slotEnd.getTime() - app.startTime.getTime())).toBeGreaterThanOrEqual(15 * 60 * 1000);
      }
    }
    for (const slot of resultC!.recommendedSlots) {
      const slotStart = new Date(slot);
      const slotEnd = new Date(slotStart.getTime() + 30 * 60 * 1000);
      for (const app of appointments.phys3) {
        expect(Math.abs(slotStart.getTime() - app.endTime.getTime())).toBeGreaterThanOrEqual(15 * 60 * 1000);
        expect(Math.abs(slotEnd.getTime() - app.startTime.getTime())).toBeGreaterThanOrEqual(15 * 60 * 1000);
      }
    }
  });
});

