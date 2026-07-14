import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    Patch,
    Post,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger'; // ← NUEVO
import { TasksService } from './tasks.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';

@ApiTags('tasks') // ← NUEVO
@Controller('tasks')
export class TasksController {
    constructor(private readonly tasks: TasksService) { }

    @Post()
    @ApiOperation({ summary: 'Crear tarea' }) // ← NUEVO
    create(@Body() dto: CreateTaskDto) {
        return this.tasks.create(dto);
    }

    @Get()
    @ApiOperation({ summary: 'Listar todas las tareas' }) // ← NUEVO
    findAll() {
        return this.tasks.findAll();
    }

    @Get(':id')
    @ApiOperation({ summary: 'Obtener tarea por id' }) // ← NUEVO
    @ApiParam({ name: 'id', example: '550e8400-e29b-41d4-a716-446655440000' }) // ← NUEVO
    findOne(@Param('id') id: string) {
        return this.tasks.findOne(id);
    }

    @Patch(':id')
    @ApiOperation({ summary: 'Actualizar tarea' }) // ← NUEVO
    @ApiParam({ name: 'id', example: '550e8400-e29b-41d4-a716-446655440000' }) // ← NUEVO
    update(@Param('id') id: string, @Body() dto: UpdateTaskDto) {
        return this.tasks.update(id, dto);
    }

    @Delete(':id')
    @ApiOperation({ summary: 'Eliminar tarea' }) // ← NUEVO
    @ApiParam({ name: 'id', example: '550e8400-e29b-41d4-a716-446655440000' }) // ← NUEVO
    remove(@Param('id') id: string) {
        return this.tasks.remove(id);
    }
}