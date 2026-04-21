import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
  @Get()
  root() {
    return { ok: true, service: 'kartiki-backend' };
  }

  @Get('health')
  health() {
    return { ok: true, ts: new Date().toISOString() };
  }
}
