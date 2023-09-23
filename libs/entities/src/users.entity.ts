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

export class LastSeenEntity {
  name: string;
  tag: string;
  clan: {
    name: string;
    tag: string;
  };
  lastSeen?: Date;
  createdAt: Date;
}
