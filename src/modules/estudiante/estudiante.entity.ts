import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('estudiante')
export class Estudiante {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  nombre: string;

  @Column()
  apellido: string;

  @Column()
  codigo: string;
}
