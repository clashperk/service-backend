import { DataSource, DataSourceOptions } from 'typeorm';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';

if (!process.env.NAME) {
  throw new Error('Migration name not provided.');
}

export const dataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  host: process.env.POSTGRES_HOST,
  port: Number(process.env.POSTGRES_PORT),
  username: process.env.POSTGRES_USERNAME,
  password: process.env.POSTGRES_PASSWORD,
  database: process.env.POSTGRES_DB,
  entities: ['./src/db/entities/**/*.entity.ts'],
  migrations: ['./src/db/migrations/**/[!index]*.ts'],
  namingStrategy: new SnakeNamingStrategy(),
  migrationsTableName: 'migrations',
  synchronize: false,
  logging: false,
};

export default new DataSource(dataSourceOptions);
