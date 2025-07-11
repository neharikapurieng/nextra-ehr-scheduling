import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity()
export class BillingRule {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  region: string; // e.g., 'Ontario'

  @Column('int')
  gapDurationMinutes: number; // e.g., 15

  @Column('int', { nullable: true })
  beforeAppointmentBuffer: number;

  @Column('int', { nullable: true })
  afterAppointmentBuffer: number;
}
