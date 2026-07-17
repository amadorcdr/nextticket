import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMinSize,
  IsArray,
  IsUUID,
} from 'class-validator';

export class AssignSectionsDto {
  @ApiProperty({
    type: [String],
    example: [
      '550e8400-e29b-41d4-a716-446655440001',
      '550e8400-e29b-41d4-a716-446655440002',
    ],
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', {
    each: true,
  })
  sectionIds!: string[];
}