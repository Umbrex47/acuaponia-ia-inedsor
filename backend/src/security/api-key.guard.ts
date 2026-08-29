import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Guard de API key para endpoints de escritura.
 * - Si la API key no está configurada o REQUIRE_API_KEY=false, no valida.
 * - Si está configurada, exige el header `Authorization: Bearer <key>`.
 */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  private readonly logger = new Logger(ApiKeyGuard.name);
  private apiKey = '';
  private requireApiKey = false;

  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.get<string>('security.apiKey', '');
    this.requireApiKey = this.config.get<boolean>('security.requireApiKey', false);
  }

  canActivate(context: ExecutionContext): boolean {
    if (!this.apiKey) {
      if (this.requireApiKey) {
        throw new UnauthorizedException('API key no configurada en el servidor');
      }
      return true;
    }

    const req = context.switchToHttp().getRequest();
    const header = (req.headers?.authorization || req.headers?.Authorization || '') as string;
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
    if (token !== this.apiKey) {
      this.logger.warn('API key inválida');
      throw new UnauthorizedException('API key inválida');
    }
    return true;
  }
}
