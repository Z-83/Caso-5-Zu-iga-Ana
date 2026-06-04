import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Estudiante } from './estudiante.entity';
import { CreateEstudianteDto } from './estudiante.dto';

@Injectable()
export class EstudianteService {
  constructor(
    @InjectRepository(Estudiante)
    private readonly estudianteRepository: Repository<Estudiante>,
  ) {}

  create(dto: CreateEstudianteDto): Promise<Estudiante> {
    const estudiante = this.estudianteRepository.create(dto);
    return this.estudianteRepository.save(estudiante);
  }

  findAll(): Promise<Estudiante[]> {
    return this.estudianteRepository.find();
  }
}
