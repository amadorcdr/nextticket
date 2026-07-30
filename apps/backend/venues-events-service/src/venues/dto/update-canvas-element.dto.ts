import { PartialType } from '@nestjs/swagger';
import { CreateCanvasElementDto } from './create-canvas-element.dto';

export class UpdateCanvasElementDto extends PartialType(
  CreateCanvasElementDto,
) {}
