import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Physician } from '../entities/physician.entity';
import { Appointment } from '../entities/appointment.entity';
import { AvailabilityBlock } from '../entities/availability-block.entity';
import { BillingRule } from '../entities/billing-rule.entity';
import { validate as isUuid } from 'uuid';

interface RecommendSlotsDto {
  clinicId: string;
  physicianId: string;
  patientId: string;
  preferredDate: string; // YYYY-MM-DD
  durationMinutes: number;
}

@Injectable()
export class AppointmentsService {
  constructor(
    @InjectRepository(Physician)
    private physicianRepo: Repository<Physician>,
    @InjectRepository(Appointment)
    private appointmentRepo: Repository<Appointment>,
    @InjectRepository(AvailabilityBlock)
    private availabilityBlockRepo: Repository<AvailabilityBlock>,
    @InjectRepository(BillingRule)
    private billingRuleRepo: Repository<BillingRule>,
  ) {}

  async recommendSlots(dto: RecommendSlotsDto) {
    // 1. Fetch physician, availability, appointments, and billing rules
    let physician;
    physician = await this.physicianRepo.findOne({
      where: { code: dto.physicianId, clinicId: dto.clinicId },
    });
    if (!physician) {
      console.error('DEBUG: Physician not found for', dto.physicianId, dto.clinicId);
      throw new Error('Physician not found');
    }

    // Fetch all appointments for the physician in the clinic
    const appointments = await this.appointmentRepo.find({
      where: { physician: { id: physician.id }, clinicId: dto.clinicId },
    });

    // Fetch all availability blocks for the physician in the clinic
    const availabilityBlocks = await this.availabilityBlockRepo.find({
      where: { physician: { id: physician.id }, clinicId: dto.clinicId },
    });

    // Fetch Ontario billing rule (gap/buffer requirements)
    const billingRule = await this.billingRuleRepo.findOne({ where: { region: 'Ontario' } });
    const gap = billingRule?.gapDurationMinutes || 15;
    const beforeBuffer = billingRule?.beforeAppointmentBuffer || 0;
    const afterBuffer = billingRule?.afterAppointmentBuffer || 0;

    // 2. Generate all possible slots for the preferred date
    // Get working hours for the day of week (use UTC to avoid timezone issues)
    const date = new Date(dto.preferredDate + 'T00:00:00Z'); // force UTC
    const dayOfWeek = date.toLocaleString('en-US', { weekday: 'short', timeZone: 'UTC' }).toLowerCase();
    const workingHours = physician.workingHours || {};
    const hours = workingHours[dayOfWeek];
    if (!hours || hours.length !== 2) {
      console.error('DEBUG: No working hours for this day', dayOfWeek, workingHours);
      return { status: 'error', recommendedSlots: [], message: 'No working hours for this day' };
    }
    const [startStr, endStr] = hours;
    // Parse start and end of working hours
    const start = new Date(`${dto.preferredDate}T${startStr}:00`);
    const end = new Date(`${dto.preferredDate}T${endStr}:00`);
    const slots: { time: Date; score: number }[] = [];
    let slot = new Date(start);
    // Sort availability blocks and appointments for efficient skipping
    const sortedBlocks = availabilityBlocks
      .filter(block => block.type === 'available')
      .sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
    const sortedAppointments = appointments.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
    let blockIdx = 0;
    let appIdx = 0;
    while (slot.getTime() + dto.durationMinutes * 60000 <= end.getTime()) {
      // Find the next available block that could fit this slot
      while (
        blockIdx < sortedBlocks.length &&
        (slot < sortedBlocks[blockIdx].startTime ||
          new Date(slot.getTime() + dto.durationMinutes * 60000) > sortedBlocks[blockIdx].endTime)
      ) {
        blockIdx++;
      }
      if (blockIdx >= sortedBlocks.length) break; // No more available blocks
      // Snap slot to the start of the next available block if needed
      if (slot < sortedBlocks[blockIdx].startTime) {
        slot = new Date(sortedBlocks[blockIdx].startTime);
      }
      const slotEnd = new Date(slot.getTime() + dto.durationMinutes * 60000);
      if (slotEnd > sortedBlocks[blockIdx].endTime) {
        // Move to next block
        slot = new Date(sortedBlocks[blockIdx].endTime);
        blockIdx++;
        continue;
      }
      // Check for appointment conflicts and billing gaps
      let hasConflict = false;
      let nextAvailableTime = slot.getTime() + gap * 60000;
      for (const app of sortedAppointments) {
        const appStart = new Date(app.startTime.getTime() - beforeBuffer * 60000);
        const appEnd = new Date(app.endTime.getTime() + afterBuffer * 60000);
        if (
          (slot >= appStart && slot < appEnd) ||
          (slotEnd > appStart && slotEnd <= appEnd) ||
          (slot <= appStart && slotEnd >= appEnd)
        ) {
          hasConflict = true;
          // Skip to the end of this appointment (plus buffer/gap)
          nextAvailableTime = Math.max(nextAvailableTime, appEnd.getTime());
          break;
        }
        // Check for minimum gap from previous/next appointments
        if (
          Math.abs(slot.getTime() - app.endTime.getTime()) < gap * 60000 ||
          Math.abs(slotEnd.getTime() - app.startTime.getTime()) < gap * 60000
        ) {
          hasConflict = true;
          // Skip to the end of this appointment (plus gap)
          nextAvailableTime = Math.max(nextAvailableTime, appEnd.getTime() + gap * 60000);
          break;
        }
      }
      if (hasConflict) {
        slot = new Date(nextAvailableTime);
        continue;
      }
      // If slot is valid, score it for disruptiveness
      let score = 0;
      let minPrevGap = Infinity;
      let minNextGap = Infinity;
      for (const app of sortedAppointments) {
        const appEnd = new Date(app.endTime);
        const appStart = new Date(app.startTime);
        if (appEnd <= slot) {
          minPrevGap = Math.min(minPrevGap, slot.getTime() - appEnd.getTime());
        }
        if (appStart >= slotEnd) {
          minNextGap = Math.min(minNextGap, appStart.getTime() - slotEnd.getTime());
        }
      }
      // If the slot is right next to an appointment (but still meets gap), penalize
      if (Math.abs(minPrevGap) < 2 * gap * 60000 || Math.abs(minNextGap) < 2 * gap * 60000) {
        score -= 10;
      }
      // If the slot is at the very start or end of the working day, penalize slightly
      if (slot.getTime() === start.getTime() || slotEnd.getTime() === end.getTime()) {
        score -= 5;
      }
      // If the slot is squeezed between two appointments (both gaps < 30min), penalize
      if (minPrevGap < 30 * 60000 && minNextGap < 30 * 60000) {
        score += 10;
      }
      // Prefer slots with larger gaps before/after
      score += Math.min(minPrevGap, minNextGap) / 60000;
      slots.push({ time: new Date(slot), score });
      // Move to next slot (gap increment)
      slot = new Date(slot.getTime() + gap * 60000);
    }
    // Sort slots by score (lower is better)
    slots.sort((a, b) => a.score - b.score);
    // Return top 10 slots
    return {
      status: 'success',
      recommendedSlots: slots.slice(0, 10).map(s => s.time.toISOString().slice(0, 16) + ':00'),
    };
  }
}
