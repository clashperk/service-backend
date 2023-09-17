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
