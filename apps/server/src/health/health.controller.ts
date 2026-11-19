import { Controller, Get } from '@nestjs/common';
import { RoomsService } from '../rooms/rooms.service';

@Controller('health')
export class HealthController {
  constructor(private readonly rooms: RoomsService) {}

  @Get()
  health(): { status: 'ok'; uptime: number; rooms: number } {
    return { status: 'ok', uptime: Math.round(process.uptime()), rooms: this.rooms.count() };
  }
}
