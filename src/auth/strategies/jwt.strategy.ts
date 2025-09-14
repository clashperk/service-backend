import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthGuardStrategies } from '../app.constants';
import { AuthService } from '../auth.service';
import { JwtUser } from '../dto';

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
    });
  }

  async validate(payload: JwtUser): Promise<JwtUser> {
    return this.authService.revalidateJwtUser(payload);
  }
}
