import { Test, TestingModule } from '@nestjs/testing';
import { DiscordOAuthService } from './discord-oauth.service';

describe('DiscordOAuthService', () => {
  let service: DiscordOAuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DiscordOAuthService],
    }).compile();

    service = module.get<DiscordOAuthService>(DiscordOAuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
