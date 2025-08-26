import { MigrationInterface, QueryRunner } from "typeorm";

export class InitDb1756061630963 implements MigrationInterface {
    name = 'InitDb1756061630963'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "users" ("id" bigint GENERATED ALWAYS AS IDENTITY NOT NULL, "name" character varying NOT NULL, CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "settings" ("guild_id" bigint GENERATED ALWAYS AS IDENTITY NOT NULL, "name" character varying NOT NULL, CONSTRAINT "PK_a3856408f6ded4476405539593a" PRIMARY KEY ("guild_id"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "settings"`);
        await queryRunner.query(`DROP TABLE "users"`);
    }

}
