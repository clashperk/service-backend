export class CustomBotsEntity {
  applicationId: string;
  name: string;
  userId: string;
  token: string;
  patronId: string;
  serviceId: string;
  isLive: boolean;
  /** Set by the service that runs the bot containers: the container is up. */
  isRunning: boolean;
  /** Set by that service: the bot runs as production, which it is once set up. */
  isProd: boolean;
  /** Set by that service: the bot is suspended. */
  isDisabled: boolean;
  guildIds: string[];
  updatedAt: Date;
  createdAt: Date;
}
