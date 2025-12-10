import {
  Injectable,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { EntityManager } from '@mikro-orm/postgresql';
import * as bcrypt from 'bcryptjs';
import { createHash, randomUUID } from 'crypto';
import { User } from './entities/user.entity';
import { Session } from './entities/session.entity';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

interface TokenPayload {
  sub: string;
  email: string;
  type: 'access' | 'refresh';
  jti?: string; // Unique token ID for refresh tokens
}

interface AuthResult {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: User;
}

@Injectable()
export class AuthService {
  private readonly accessTokenExpiresIn = 900; // 15 minutes in seconds
  private readonly refreshTokenExpiresInDays = 7;

  constructor(
    private readonly em: EntityManager,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async register(
    dto: RegisterDto,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<AuthResult> {
    // Check if email already exists
    const existingUser = await this.em.findOne(User, { email: dto.email });
    if (existingUser) {
      throw new ConflictException('Email already exists');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(dto.password, 12);

    // Create user
    const user = this.em.create(User, {
      email: dto.email,
      passwordHash,
      firstName: dto.firstName,
      lastName: dto.lastName,
    });

    await this.em.persistAndFlush(user);

    // Generate tokens and create session
    return this.createAuthResult(user, ipAddress, userAgent);
  }

  async login(
    dto: LoginDto,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<AuthResult> {
    // Find user by email
    const user = await this.em.findOne(User, {
      email: dto.email,
      deletedAt: null,
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check if user is active
    if (!user.isActive) {
      throw new UnauthorizedException('Account is disabled');
    }

    // Update last login
    user.lastLoginAt = new Date();
    await this.em.flush();

    // Generate tokens and create session
    return this.createAuthResult(user, ipAddress, userAgent);
  }

  async refreshTokens(
    refreshToken: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<AuthResult> {
    // Verify the refresh token
    let payload: TokenPayload;
    try {
      payload = this.jwtService.verify<TokenPayload>(refreshToken);
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (payload.type !== 'refresh') {
      throw new UnauthorizedException('Invalid token type');
    }

    // Find session by token hash
    const tokenHash = this.hashToken(refreshToken);
    const session = await this.em.findOne(
      Session,
      { tokenHash },
      { populate: ['user'] },
    );

    if (!session) {
      throw new UnauthorizedException('Session not found');
    }

    // Check if session is expired
    if (session.expiresAt < new Date()) {
      await this.em.removeAndFlush(session);
      throw new UnauthorizedException('Session expired');
    }

    // Check if user is still active
    if (!session.user.isActive) {
      await this.em.removeAndFlush(session);
      throw new UnauthorizedException('Account is disabled');
    }

    // Delete old session (token rotation)
    await this.em.removeAndFlush(session);

    // Create new session with new tokens
    return this.createAuthResult(session.user, ipAddress, userAgent);
  }

  async logout(userId: string, refreshToken?: string): Promise<void> {
    if (refreshToken) {
      // Delete specific session
      const tokenHash = this.hashToken(refreshToken);
      const session = await this.em.findOne(Session, {
        tokenHash,
        user: { id: userId },
      });
      if (session) {
        await this.em.removeAndFlush(session);
      }
    } else {
      // Delete all sessions for user
      const sessions = await this.em.find(Session, { user: { id: userId } });
      await this.em.removeAndFlush(sessions);
    }
  }

  async validateUserById(userId: string): Promise<User | null> {
    return this.em.findOne(User, {
      id: userId,
      isActive: true,
      deletedAt: null,
    });
  }

  async getCurrentUser(userId: string): Promise<User> {
    const user = await this.em.findOne(User, { id: userId, deletedAt: null });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    return user;
  }

  private async createAuthResult(
    user: User,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<AuthResult> {
    // Generate access token
    const accessTokenPayload: TokenPayload = {
      sub: user.id,
      email: user.email,
      type: 'access',
    };
    const accessToken = this.jwtService.sign(accessTokenPayload, {
      expiresIn: this.accessTokenExpiresIn,
    });

    // Generate refresh token with unique jti
    const refreshTokenPayload: TokenPayload = {
      sub: user.id,
      email: user.email,
      type: 'refresh',
      jti: randomUUID(),
    };
    const refreshToken = this.jwtService.sign(refreshTokenPayload, {
      expiresIn: `${this.refreshTokenExpiresInDays}d`,
    });

    // Create session
    const tokenHash = this.hashToken(refreshToken);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + this.refreshTokenExpiresInDays);

    const session = this.em.create(Session, {
      user,
      tokenHash,
      ipAddress,
      userAgent,
      expiresAt,
    });

    await this.em.persistAndFlush(session);

    return {
      accessToken,
      refreshToken,
      expiresIn: this.accessTokenExpiresIn,
      user,
    };
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
