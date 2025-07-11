import { Controller, Post, Body, UsePipes, ValidationPipe, BadRequestException } from '@nestjs/common';
import { AppointmentsService } from './appointments.service';
import { IsString, IsUUID, IsDateString, IsInt, Min } from 'class-validator';

class RecommendSlotsDto {
  @IsString()
  clinicId: string;

  @IsString()
  physicianId: string;

  @IsString()
  patientId: string;

  @IsDateString()
  preferredDate: string; // YYYY-MM-DD

  @IsInt()
  @Min(1)
  durationMinutes: number;
}

@Controller('appointments')
export class AppointmentsController {
  constructor(private readonly appointmentsService: AppointmentsService) {}

  @Post('recommend')
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
  async recommendSlots(@Body() dto: RecommendSlotsDto) {
    try {
      return await this.appointmentsService.recommendSlots(dto);
    } catch (error) {
      throw new BadRequestException(error.message || 'Invalid input');
    }
  }
}
