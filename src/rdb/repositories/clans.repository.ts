import { Injectable, Logger, Optional } from '@nestjs/common';
import { EntityManager, EntityTarget, MongoRepository } from 'typeorm';
import { UsersEntity } from '../entities';

@Injectable()
export class UsersRepository extends MongoRepository<UsersEntity> {
  private logger = new Logger(UsersRepository.name);

  constructor(@Optional() _target: EntityTarget<UsersEntity>, entityManager: EntityManager) {
    super(UsersEntity, entityManager);
  }
}
