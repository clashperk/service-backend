import { getClientIp } from '@app/helpers';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import * as Sentry from '@sentry/nestjs';
import { Request } from 'express';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthGuardStrategies, DASHBOARD_TOKEN_VERSION } from '../app.constants';
import { AuthService } from '../auth.service';
import { JwtUser } from '../dto';

// Clients a browser never identifies as.
const SCRIPT_AGENT =
  /^(curl|wget|python|aiohttp|httpx|axios|got|okhttp|go-http-client|java|apache-httpclient|postmanruntime|insomnia|httpie|powershell|libwww-perl|ruby|php|dart|deno|bun|node|undici)\b/i;

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, AuthGuardStrategies.JWT) {
  constructor(
    configService: ConfigService,
    private authService: AuthService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        ExtractJwt.fromHeader('x-access-token'),
      ]),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow('JWT_SECRET'),
      passReqToCallback: true,
    });
  }

  async validate(req: Request, payload: JwtUser): Promise<JwtUser> {
    const user = await this.authService.revalidateJwtUser(payload);
    const portal = payload.version !== DASHBOARD_TOKEN_VERSION;
    if (!portal) this.reportScriptUse(req, user);
    return { ...user, portal };
  }

  /** Dashboard tokens belong to a browser session; one sent by a script was likely copied out. */
  private reportScriptUse(req: Request, user: JwtUser) {
    const userAgent = req.headers['user-agent'];
    if (userAgent && !SCRIPT_AGENT.test(userAgent)) return;

    Sentry.logger.warn('Dashboard token sent by a script', {
      'token.jti': user.jti,
      'user.userId': user.userId,
      'user.username': user.username,
      'ip': getClientIp(req),
      'user_agent': userAgent,
      'method': req.method,
      'path': req.url,
    });
  }
}
