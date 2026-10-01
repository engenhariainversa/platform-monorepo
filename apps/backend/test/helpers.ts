import { INestApplication } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { prisma, type Role, type User } from "@repo/database";
import { AppModule } from "../src/app.module";

export type GqlResponse<T = any> = {
  data?: T;
  errors?: { message: string; extensions?: Record<string, any> }[];
};

export async function createTestApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication();
  await app.init();
  return app;
}

export async function resetDatabase(): Promise<void> {
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  if (tables.length === 0) return;
  const list = tables.map((t) => `"public"."${t.tablename}"`).join(", ");
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} CASCADE`);
}

const ROLE_FLAGS = {
  ADMIN: { label: "Administrador", isAdmin: true },
  MANAGER: { label: "Gerente", isAdmin: false },
  AUTHENTICATED: { label: "Autenticado", isAdmin: false },
} as const;

let userSeq = 0;

export async function createUser(
  opts: { admin?: boolean; roleName?: keyof typeof ROLE_FLAGS } = {},
): Promise<User & { role: Role }> {
  const roleName = opts.roleName ?? (opts.admin === false ? "AUTHENTICATED" : "ADMIN");
  const flags = ROLE_FLAGS[roleName];
  const role = await prisma.role.upsert({
    where: { name: roleName },
    update: {},
    create: { name: roleName, label: flags.label, isAdmin: flags.isAdmin, isSystem: true },
  });
  userSeq += 1;
  return prisma.user.create({
    data: {
      firstName: "Test",
      lastName: `User${userSeq}`,
      email: `user${userSeq}-${Date.now()}@test.dev`,
      username: `user${userSeq}-${Date.now()}`,
      password: "not-used",
      roleId: role.id,
    },
    include: { role: true },
  });
}

export function jwtFor(app: INestApplication, user: User & { role: Role }): string {
  return app
    .get(JwtService, { strict: false })
    .sign({ sub: user.id, email: user.email, role: user.role.name });
}

export async function gql<T = any>(
  app: INestApplication,
  query: string,
  variables?: Record<string, unknown>,
  token?: string,
): Promise<GqlResponse<T>> {
  const req = request(app.getHttpServer()).post("/graphql");
  if (token) req.set("Authorization", `Bearer ${token}`);
  const res = await req.send({ query, variables });
  return res.body as GqlResponse<T>;
}

export function errorCode(res: GqlResponse): string | undefined {
  return res.errors?.[0]?.extensions?.code;
}
