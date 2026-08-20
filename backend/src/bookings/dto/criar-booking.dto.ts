import {
  ArrayNotEmpty,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class CriarBookingDto {
  @IsString()
  ticketTypeId!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  quantidade?: number;

  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  assentos?: string[];
}
