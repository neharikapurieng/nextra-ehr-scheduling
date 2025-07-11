import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';
import { Physician } from './physician.entity';
import { Patient } from './patient.entity';

@Entity()
export class Appointment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  clinicId: string;

  @ManyToOne(() => Physician, (physician) => physician.appointments)
  physician: Physician;

  @ManyToOne(() => Patient, (patient) => patient.appointments)
  patient: Patient;

  @Column('timestamp')
  startTime: Date;

  @Column('timestamp')
  endTime: Date;

  @Column({ default: 'booked' })
  status: string;
}
