import { INestApplication } from "@nestjs/common";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createTestApp, createUser, errorCode, gql, jwtFor, resetDatabase } from "../test/helpers";

describe("test harness", () => {
  let app: INestApplication;
  beforeAll(async () => {
    app = await createTestApp();
  });
  afterAll(async () => {
    await app.close();
  });
  beforeEach(resetDatabase);

  it("serves GraphQL", async () => {
    const res = await gql(app, "{ hello }");
    expect(res.data?.hello).toContain("Engenhariainversa");
  });

  it("authenticates a JWT minted by the helper", async () => {
    const user = await createUser({ admin: true });
    const res = await gql(app, "{ me { id } }", undefined, jwtFor(app, user));
    expect(res.data?.me.id).toBe(user.id);
  });

  it("maps a missing token to UNAUTHENTICATED", async () => {
    const res = await gql(app, "{ me { id } }");
    expect(errorCode(res)).toBe("UNAUTHENTICATED");
  });
});
