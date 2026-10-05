import { INestApplication } from "@nestjs/common";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@repo/database";
import { createTestApp, createUser, errorCode, gql, jwtFor, resetDatabase } from "../../test/helpers";

const DELETE = `mutation ($id: String!) { deleteUser(id: $id) }`;

describe("deleteUser", () => {
  let app: INestApplication;
  beforeAll(async () => {
    app = await createTestApp();
  });
  afterAll(async () => {
    await app.close();
  });
  beforeEach(resetDatabase);

  it("deletes a user who minted API keys, along with the keys", async () => {
    const admin = jwtFor(app, await createUser({ admin: true }));
    const user = await createUser({ roleName: "AUTHENTICATED" });
    await prisma.apiKey.create({
      data: { name: "k", prefix: "abcdefgh", hash: "h1", createdById: user.id, expiresAt: new Date(Date.now() + 3_600_000) },
    });

    const res = await gql(app, DELETE, { id: user.id }, admin);
    expect(res.errors).toBeUndefined();
    expect(res.data.deleteUser).toBe(true);
    expect(await prisma.user.findUnique({ where: { id: user.id } })).toBeNull();
    expect(await prisma.apiKey.count()).toBe(0);
  });

  it("refuses to delete a user who owns presentations, and deletes nothing", async () => {
    const admin = jwtFor(app, await createUser({ admin: true }));
    const user = await createUser({ roleName: "AUTHENTICATED" });
    await prisma.apiKey.create({
      data: { name: "k", prefix: "abcdefgh", hash: "h2", createdById: user.id, expiresAt: new Date(Date.now() + 3_600_000) },
    });
    await prisma.presentation.create({ data: { slug: "deck", title: "Deck", createdById: user.id } });

    const res = await gql(app, DELETE, { id: user.id }, admin);
    expect(errorCode(res)).toBe("BAD_USER_INPUT");
    expect(res.errors?.[0].message).toBe("Este usuário possui apresentações; transfira ou exclua-as antes.");
    expect(await prisma.user.findUnique({ where: { id: user.id } })).not.toBeNull();
    expect(await prisma.apiKey.count()).toBe(1);
    expect(await prisma.presentation.count()).toBe(1);
  });
});
