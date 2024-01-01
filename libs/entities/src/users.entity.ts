export class UsersEntity {
  userId: string;

  clan: {
    name: string;
    tag: string;
  };

  timezone: {
    id: string;
  };

  createdAt: Date;
}

export class PlayersEntity {
  name: string;
  tag: string;
  clan: {
    name: string;
    tag: string;
  };
  lastSeen: Date | null;
  createdAt: Date;
}
