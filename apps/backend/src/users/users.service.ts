import { Injectable } from "@nestjs/common";
import { prisma } from "@repo/database";
import * as bcrypt from "bcryptjs";
import { CreateUserInput, UpdateUserInput, Role } from "./users.types";

@Injectable()
export class UsersService {
  async create(input: CreateUserInput) {
    const hashedPassword = await bcrypt.hash(input.password, 12);
    return prisma.user.create({
      data: {
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email,
        username: input.username,
        password: hashedPassword,
        role: input.role || "AUTHENTICATED",
      },
    });
  }

  async findAll() {
    return prisma.user.findMany({
      orderBy: { createdAt: "desc" },
    });
  }

  async findById(id: string) {
    return prisma.user.findUnique({ where: { id } });
  }

  async findByEmail(email: string) {
    return prisma.user.findUnique({ where: { email } });
  }

  async findByUsername(username: string) {
    return prisma.user.findUnique({ where: { username } });
  }

  async findByEmailOrUsername(identifier: string) {
    return prisma.user.findFirst({
      where: {
        OR: [{ email: identifier }, { username: identifier }],
      },
    });
  }

  async update(id: string, input: UpdateUserInput) {
    return prisma.user.update({
      where: { id },
      data: {
        ...(input.firstName && { firstName: input.firstName }),
        ...(input.lastName && { lastName: input.lastName }),
        ...(input.email && { email: input.email }),
        ...(input.role && { role: input.role }),
      },
    });
  }

  async updateRole(id: string, role: Role) {
    return prisma.user.update({
      where: { id },
      data: { role },
    });
  }

  async delete(id: string) {
    return prisma.user.delete({ where: { id } });
  }

  async count() {
    return prisma.user.count();
  }

  async countAdmins() {
    return prisma.user.count({ where: { role: "ADMIN" } });
  }

  async validatePassword(plaintext: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plaintext, hash);
  }
}
