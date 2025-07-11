import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { Appointment } from './appointment.entity';
import { AvailabilityBlock } from './availability-block.entity';

@Entity()
export class Physician {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  code: string; // business ID, e.g., 'p001'

  @Column()
  name: string;

  @Column({ nullable: true })
  specialty: string;

  @Column()
  clinicId: string;

  @Column('jsonb', { nullable: true })
  workingHours: any; // e.g., { mon: ['09:00', '17:00'], ... }

  @OneToMany(() => Appointment, (appointment) => appointment.physician)
  appointments: Appointment[];

  @OneToMany(() => AvailabilityBlock, (block) => block.physician)
  availabilityBlocks: AvailabilityBlock[];
}
