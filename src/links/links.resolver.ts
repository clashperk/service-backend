import { UseGuards } from '@nestjs/common';
import { Args, Query, Resolver } from '@nestjs/graphql';
import { JwtAuthGuard, Roles, RolesGuard, UseApiKey, UserRoles } from '../auth';
import { BulkLinksInputDto, LinksDto } from './dto';
import { LinksService } from './links.service';

@Resolver()
@UseGuards(JwtAuthGuard, RolesGuard)
@UseApiKey()
export class LinksResolver {
  constructor(private linksService: LinksService) {}

  @Query(() => [LinksDto])
  @Roles([UserRoles.FETCH_LINKS])
  getLinks(@Args('input') input: BulkLinksInputDto): Promise<LinksDto[]> {
    if (input.playerTags?.length) {
      return this.linksService.getLinksByPlayerTags(input.playerTags);
    }
    return this.linksService.getLinksByUserIds(input.userIds);
  }
}
