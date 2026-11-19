import { Controller, Get } from '@nestjs/common';
import type { RoomSummary } from '@shadow-front/shared-types';
import { RoomsService } from './rooms.service';

@Controller('rooms')
export class RoomsController {
  constructor(private readonly rooms: RoomsService) {}

  @Get()
  list(): RoomSummary[] {
    return this.rooms.list();
  }
}
