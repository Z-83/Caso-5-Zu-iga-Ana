import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Estudiante } from './estudiante.entity';
import { EstudianteService } from './estudiante.service';
import { EstudianteController } from './estudiante.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Estudiante])],
  providers: [EstudianteService],
  controllers: [EstudianteController],
})
export class EstudianteModule {}
