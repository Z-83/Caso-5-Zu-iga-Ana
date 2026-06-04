import { Controller, Get, Post, Body } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { EstudianteService } from './estudiante.service';
import { CreateEstudianteDto } from './estudiante.dto';

@ApiTags('Estudiante')
@Controller('estudiante')
export class EstudianteController {
  constructor(private readonly estudianteService: EstudianteService) {}

  @Post()
  create(@Body() dto: CreateEstudianteDto) {
    return this.estudianteService.create(dto);
  }

  @Get()
  findAll() {
    return this.estudianteService.findAll();
  }
}
