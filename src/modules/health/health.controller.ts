import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '@database/prisma.service';
import { Public } from '@common/decorators/public.decorator';
import { ServiceUnavailableException } from '@common/exceptions';

/**
 * Sonda de saúde usada pelo `HEALTHCHECK` da imagem Docker e pelo health
 * check da plataforma de deploy. Responde `200` só quando a API consegue
 * falar com o PostgreSQL; caso contrário `503`, para que o orquestrador não
 * envie tráfego (nem dê o deploy por concluído) com a BD inacessível.
 */
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get()
  async check() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      throw new ServiceUnavailableException(
        'Base de dados indisponível',
        'DATABASE_UNAVAILABLE',
      );
    }

    return {
      status: 'ok',
      db: 'up',
      uptime: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  }
}
