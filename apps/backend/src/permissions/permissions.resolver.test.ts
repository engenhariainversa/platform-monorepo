import { INestApplication } from "@nestjs/common";
import { GraphQLError } from "graphql";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@repo/database";
import { createTestApp, createUser, errorCode, gql, jwtFor, resetDatabase } from "../../test/helpers";
import { PermissionsService } from "./permissions.service";

const TOGGLE_PERMISSION = `mutation ($input: TogglePermissionInput!) { togglePermission(input: $input) }`;
const TOGGLE_PUBLIC = `mutation ($input: TogglePublicResourceInput!) { togglePublicResource(input: $input) }`;
const PERMISSIONS_FOR_ROLE = `query ($roleId: String!) { permissionsForRole(roleId: $roleId) { resource read } }`;

describe("Permissions over GraphQL", () => {
  let app: INestApplication;
  beforeAll(async () => {
    app = await createTestApp();
  });
  afterAll(async () => {
    await app.close();
  });
  beforeEach(resetDatabase);

  it.each(["AUTHENTICATED", "MANAGER"] as const)(
    "refuses permission management to a %s user",
    async (roleName) => {
      const user = await createUser({ roleName });
      const jwt = jwtFor(app, user);
      const input = { roleId: user.roleId, resource: "presentations", action: "update" };

      expect(errorCode(await gql(app, TOGGLE_PERMISSION, { input }, jwt))).toBe("FORBIDDEN");
      expect(errorCode(await gql(app, TOGGLE_PUBLIC, { input: { resource: "hero" } }, jwt))).toBe("FORBIDDEN");
      expect(errorCode(await gql(app, PERMISSIONS_FOR_ROLE, { roleId: user.roleId }, jwt))).toBe("FORBIDDEN");
      expect(await prisma.permission.count()).toBe(0);
      expect(await prisma.publicResource.count()).toBe(0);
    },
  );

  it("lets an admin toggle permissions and public resources", async () => {
    const admin = jwtFor(app, await createUser({ admin: true }));
    const member = await createUser({ roleName: "AUTHENTICATED" });
    const input = { roleId: member.roleId, resource: "presentations", action: "read" };

    const toggled = await gql(app, TOGGLE_PERMISSION, { input }, admin);
    expect(toggled.errors).toBeUndefined();
    expect(toggled.data.togglePermission).toBe(true);

    const listed = await gql(app, PERMISSIONS_FOR_ROLE, { roleId: member.roleId }, admin);
    expect(listed.data.permissionsForRole.find((p: any) => p.resource === "presentations").read).toBe(true);

    const pub = await gql(app, TOGGLE_PUBLIC, { input: { resource: "hero" } }, admin);
    expect(pub.errors).toBeUndefined();
    expect(pub.data.togglePublicResource).toBe(true);
  });

  it.each(["presentations", "apiKeys", "users"])(
    "refuses to make %s a public resource",
    async (resource) => {
      const admin = jwtFor(app, await createUser({ admin: true }));
      const res = await gql(app, TOGGLE_PUBLIC, { input: { resource } }, admin);
      expect(errorCode(res)).toBe("BAD_USER_INPUT");
      expect(res.errors?.[0].message).toMatch(/não pode ser público/);
      expect(await prisma.publicResource.count()).toBe(0);
    },
  );
});

describe("PermissionsService.canAccess", () => {
  const service = new PermissionsService();
  beforeEach(resetDatabase);

  it("ignores a public-resource row for non-public resources", async () => {
    const member = await createUser({ roleName: "AUTHENTICATED" });
    const role = { id: member.roleId, isAdmin: false };
    await prisma.publicResource.createMany({
      data: [{ resource: "presentations" }, { resource: "apiKeys" }, { resource: "users" }, { resource: "hero" }],
    });

    expect(await service.canAccess("presentations", "read", role)).toBe(false);
    expect(await service.canAccess("apiKeys", "read", role)).toBe(false);
    expect(await service.canAccess("users", "read", undefined)).toBe(false);
    // Ordinary resources keep the public bypass.
    expect(await service.canAccess("hero", "read", undefined)).toBe(true);
  });

  it("throws a GraphQLError when toggling a non-public resource", async () => {
    await expect(service.togglePublicResource("presentations")).rejects.toBeInstanceOf(GraphQLError);
  });
});
