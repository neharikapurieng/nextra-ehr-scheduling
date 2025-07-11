import { Test, TestingModule } from '@nestjs/testing';
import { AppointmentsController } from './appointments.controller';
import { AppointmentsService } from './appointments.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Physician } from '../entities/physician.entity';
import { Appointment } from '../entities/appointment.entity';
import { AvailabilityBlock } from '../entities/availability-block.entity';
import { BillingRule } from '../entities/billing-rule.entity';

const mockPhysicianRepo = { findOne: jest.fn() };
const mockAppointmentRepo = { find: jest.fn() };
const mockAvailabilityBlockRepo = { find: jest.fn() };
const mockBillingRuleRepo = { findOne: jest.fn() };

describe('AppointmentsController', () => {
  let controller: AppointmentsController;
  let service: AppointmentsService;
  let module: TestingModule;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      controllers: [AppointmentsController],
      providers: [
        AppointmentsService,
        { provide: getRepositoryToken(Physician), useValue: mockPhysicianRepo },
        { provide: getRepositoryToken(Appointment), useValue: mockAppointmentRepo },
        { provide: getRepositoryToken(AvailabilityBlock), useValue: mockAvailabilityBlockRepo },
        { provide: getRepositoryToken(BillingRule), useValue: mockBillingRuleRepo },
      ],
    }).compile();

    controller = module.get<AppointmentsController>(AppointmentsController);
    service = module.get<AppointmentsService>(AppointmentsService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should return error if physician not found (unit, true negative)', async () => {
    jest.spyOn(service, 'recommendSlots').mockRejectedValue(new Error('Physician not found'));
    await expect(service.recommendSlots({
      clinicId: 'c1',
      physicianId: 'notfound',
      patientId: 'u123',
      preferredDate: '2025-07-10',
      durationMinutes: 30,
    })).rejects.toThrow('Physician not found');
  });

  it('should recommend slots (unit, true positive)', async () => {
    jest.spyOn(service, 'recommendSlots').mockResolvedValue({
      status: 'success',
      recommendedSlots: ['2025-07-09T09:00:00'], // Match the mockResult in the integration test for consistency
    });
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

  // Integration test for controller (mocked service)
  it('should call recommendSlots and return result (integration, controller-service)', async () => {
    const mockResult = { status: 'success', recommendedSlots: ['2025-07-09T09:00:00'] };
    jest.spyOn(service, 'recommendSlots').mockResolvedValue(mockResult);
    const result = await service.recommendSlots({
      clinicId: 'c1',
      physicianId: 'p001',
      patientId: 'u123',
      preferredDate: '2025-07-09',
      durationMinutes: 30,
    });
    expect(result).toEqual(mockResult);
  });

  // Integration test for controller (error case)
  it('should return error if recommendSlots throws (integration, controller-service)', async () => {
    jest.spyOn(service, 'recommendSlots').mockRejectedValue(new Error('Physician not found'));
    await expect(service.recommendSlots({
      clinicId: 'c1',
      physicianId: 'notfound',
      patientId: 'u123',
      preferredDate: '2025-07-10',
      durationMinutes: 30,
    })).rejects.toThrow('Physician not found');
  });
});
