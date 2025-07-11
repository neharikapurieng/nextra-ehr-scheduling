import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EntitiesService } from './entities.service';
import { Physician } from './physician.entity';
import { Patient } from './patient.entity';
import { Appointment } from './appointment.entity';
import { AvailabilityBlock } from './availability-block.entity';
import { BillingRule } from './billing-rule.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Physician,
      Patient,
      Appointment,
      AvailabilityBlock,
      BillingRule,
    ]),
  ],
  providers: [EntitiesService],
  exports: [TypeOrmModule],
})
export class EntitiesModule {}
