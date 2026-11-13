import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '@database/prisma.service';
import { Public } from '@common/decorators/public.decorator';

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get()
  async check() {
    let dbStatus = 'UP';

    try {
      // Run raw test query
      await this.prisma.$queryRaw`SELECT 1`;
    } catch (_error) {
      dbStatus = 'DOWN';
    }

    return {
      status: dbStatus === 'UP' ? 'OK' : 'ERROR',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      details: {
        database: {
          status: dbStatus,
        },
      },
    };
  }
}
