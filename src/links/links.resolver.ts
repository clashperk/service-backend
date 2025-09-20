import { UseGuards } from '@nestjs/common';
import { Args, Query, Resolver } from '@nestjs/graphql';
import { JwtAuthGuard, Roles, RolesGuard, UserRoles } from '../auth';
import { GetLinksInputDto, LinksDto } from './dto';
import { LinksService } from './links.service';

@Resolver()
@UseGuards(JwtAuthGuard, RolesGuard)
export class LinksResolver {
  constructor(private linksService: LinksService) {}

  @Query(() => [LinksDto])
  @Roles([UserRoles.FETCH_LINKS])
  getLinks(@Args('input') input: GetLinksInputDto): Promise<LinksDto[]> {
    if (input.playerTags?.length) {
      return this.linksService.getLinksByPlayerTags(input.playerTags);
    }
    return this.linksService.getLinksByUserIds(input.userIds);
  }
}
