import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

/** Solo un ADMIN puede usar este DTO: cambiar de rol es escalar privilegios. */
export class UpdateUserRoleDto {
  @ApiProperty({
    description: 'UUID del rol que se le asigna al usuario',
    example: '22222222-2222-4222-8222-222222222222',
  })
  @IsUUID('4')
  roleId!: string;
}
