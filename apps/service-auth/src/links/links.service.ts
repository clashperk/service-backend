import { Injectable } from '@nestjs/common';
import { CreateLinkInput } from './dto/create-links.dto';
import { DeleteLinkInput } from './dto/delete-link.dto';

@Injectable()
export class LinksService {
  createLink(input: CreateLinkInput) {
    return input;
  }

  deleteLink(userId: string, input: DeleteLinkInput) {
    return { userId, input };
  }

  getLink(userIdOrTag: string) {
    return [userIdOrTag];
  }

  getLinks(playerTags: string[]) {
    return [playerTags];
  }
}
