import { Injectable, Optional } from '@nestjs/common';
import { EntityManager, EntityTarget, Repository } from 'typeorm';
import { UsersEntity } from '../entities';

@Injectable()
export class UsersRepository extends Repository<UsersEntity> {
  constructor(@Optional() _target: EntityTarget<UsersEntity>, entityManager: EntityManager) {
    super(UsersEntity, entityManager);
  }
}
