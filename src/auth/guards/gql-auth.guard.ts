import { ExecutionContext, Injectable } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { AuthGuard } from '@nestjs/passport';
import { AuthGuardStrategies } from '../app.constants';

@Injectable()
export class GqlAuthGuard extends AuthGuard(AuthGuardStrategies.JWT) {
  getRequest(context: ExecutionContext) {
    const ctx = GqlExecutionContext.create(context);
    return ctx.getContext().req; // eslint-disable-line
  }
}
