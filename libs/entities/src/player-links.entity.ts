export class PlayerLinksEntity {
  userId: string;
  username: string;
  displayName: string;
  discriminator: string;
  tag: string;
  name: string;
  order: number;
  verified: boolean;
  source: 'bot' | 'web' | 'api';
  createdAt: Date;
}
