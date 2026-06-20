import { Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { UsersService } from "../users/users.service";
import { Role } from "../users/users.types";

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async login(identifier: string, password: string) {
    const user = await this.usersService.findByEmailOrUsername(identifier);
    if (!user) {
      throw new UnauthorizedException("Credenciais inválidas");
    }

    const isValid = await this.usersService.validatePassword(
      password,
      user.password,
    );
    if (!isValid) {
      throw new UnauthorizedException("Credenciais inválidas");
    }

    const token = this.jwtService.sign({
      sub: user.id,
      email: user.email,
      role: user.role,
    });

    return { token, user };
  }

  async setupAdmin(input: {
    firstName: string;
    lastName: string;
    email: string;
    username: string;
    password: string;
  }) {
    const adminCount = await this.usersService.countAdmins();
    if (adminCount > 0) {
      throw new UnauthorizedException(
        "Admin já foi configurado. Use o login.",
      );
    }

    const user = await this.usersService.create({
      ...input,
      role: Role.ADMIN,
    });

    const token = this.jwtService.sign({
      sub: user.id,
      email: user.email,
      role: user.role,
    });

    return { token, user };
  }

  async hasAdmin(): Promise<boolean> {
    const count = await this.usersService.countAdmins();
    return count > 0;
  }

  async validateUserById(userId: string) {
    return this.usersService.findById(userId);
  }
}
