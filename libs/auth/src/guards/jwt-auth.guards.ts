import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthGuardStrategyMapping } from 'apps/service-auth/src/app.constants';

@Injectable()
export class JwtAuthGuard extends AuthGuard(AuthGuardStrategyMapping.JWT) {}
