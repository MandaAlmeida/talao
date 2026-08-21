import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class ItemPedidoDto {
  @IsString()
  ticketTypeId!: string;

  @IsInt()
  @Min(1)
  @Max(20)
  quantidade!: number;

  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  assentos?: string[];
}

export class CriarOrderDto {
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => ItemPedidoDto)
  itens!: ItemPedidoDto[];
}
