import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CatalogService } from './catalog.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ORGANIZADOR)
@Controller('catalog')
export class CatalogController {
  constructor(private catalogService: CatalogService) {}

  @Get('filmes')
  buscarFilmes(@Query('busca') busca?: string) {
    return this.catalogService.buscarFilmes(busca);
  }
}
