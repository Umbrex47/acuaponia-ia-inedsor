import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const roleHeader = req.headers['x-user-role'] || req.headers['X-User-Role'];
    const passcodeHeader = req.headers['x-admin-passcode'] || req.headers['X-Admin-Passcode'];
    const authHeader = (req.headers['authorization'] || req.headers['Authorization'] || '') as string;
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';

    const configuredApiKey = this.config.get<string>('security.apiKey', '');
    const defaultPasscode = 'admin123';

    // 1. Si coincide el token Bearer o API Key configurada
    if (configuredApiKey && token === configuredApiKey) {
      req.adminUser = 'Admin API Key';
      return true;
    }

    // 2. Si envió el passcode de admin configurado o predeterminado
    if (passcodeHeader === defaultPasscode || passcodeHeader === configuredApiKey) {
      req.adminUser = 'Admin PIN';
      return true;
    }

    // 3. Si tiene rol admin declarado en el header de cliente
    if (roleHeader === 'admin' || roleHeader === 'administrador') {
      req.adminUser = req.headers['x-operator-name'] || 'Administrador';
      return true;
    }

    // Si no se requiere autenticación estricta en local, permitir con usuario por defecto
    const isLocalDev = process.env.NODE_ENV !== 'production';
    if (isLocalDev) {
      req.adminUser = req.headers['x-operator-name'] || 'Admin Local';
      return true;
    }

    throw new UnauthorizedException('Acceso restringido a cuentas de Administrador');
  }
}
