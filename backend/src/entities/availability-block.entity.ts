import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';
import { Physician } from './physician.entity';

@Entity()
export class AvailabilityBlock {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Physician, (physician) => physician.availabilityBlocks)
  physician: Physician;

  @Column()
  clinicId: string;

  @Column('timestamp')
  startTime: Date;

  @Column('timestamp')
  endTime: Date;

  @Column({ default: 'available' })
  type: string; // available, break, vacation, etc.
}
