import { Module } from '@nestjs/common';
import { HealthController } from './health/health.controller';
import { RoomsController } from './rooms/rooms.controller';
import { RoomsService } from './rooms/rooms.service';
import { LobbyGateway } from './rooms/lobby.gateway';

@Module({
  controllers: [HealthController, RoomsController],
  providers: [RoomsService, LobbyGateway],
})
export class AppModule {}
