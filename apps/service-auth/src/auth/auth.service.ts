import { JwtUser } from '@app/auth';
import { Collections } from '@app/constants';
import { PortalUsersEntity } from '@app/entities';
import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import moment from 'moment';
import { Collection } from 'mongodb';
import { v4 as uuid } from 'uuid';

const jwtVersion = 'v1';

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    @Inject(Collections.PORTAL_USERS) private portalUsersCollection: Collection<PortalUsersEntity>,
  ) {}

  async login(passKey: string) {
    const user = await this.portalUsersCollection.findOne({ passKey });
    if (!user) throw new UnauthorizedException();

    const payload = {
      sub: user.userId,
      jti: uuid(),
      version: jwtVersion,
      roles: user.roles,
    } satisfies Partial<JwtUser>;

    return {
      userId: user.userId,
      roles: user.roles,
      expiresIn: moment().add(30, 'days').toDate().getTime(),
      accessToken: this.jwtService.sign(payload, { expiresIn: '30d' }),
    };
  }

  async validateJwt(jwtUser: JwtUser) {
    if (jwtUser.version !== jwtVersion) throw new UnauthorizedException();
    return jwtUser;
  }
}
