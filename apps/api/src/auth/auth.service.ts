import { Inject, Injectable } from '@nestjs/common';
import {
  LoginRequestSchema,
  RegisterRequestSchema,
  type LoginRequest,
  type RegisterRequest,
  type UserPublic,
} from '@aijh/contracts';
import { auditEvents, sessions, users } from '@aijh/database';
import {
  generateOpaqueToken,
  hashPassword,
  hashToken,
  verifyPassword,
} from '@aijh/security';
import { and, eq, gt, isNull } from 'drizzle-orm';
import { AppHttpException } from '../common/app-http.exception';
import { ConfigService } from '../config/config.service';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class AuthService {
  constructor(
    @Inject(DatabaseService) private readonly dbService: DatabaseService,
    @Inject(ConfigService) private readonly config: ConfigService,
  ) {}

  async register(
    raw: RegisterRequest,
    meta: { requestId?: string },
  ): Promise<{ user: UserPublic; sessionToken: string }> {
    const input = RegisterRequestSchema.parse(raw);
    const email = input.email.toLowerCase();
    const existing = await this.dbService.db.query.users.findFirst({
      where: eq(users.email, email),
    });
    if (existing) {
      throw new AppHttpException('CONFLICT', 'Email is already registered');
    }

    const passwordHash = await hashPassword(input.password);
    const [user] = await this.dbService.db
      .insert(users)
      .values({
        email,
        passwordHash,
        displayName: input.displayName ?? null,
      })
      .returning();

    if (!user) {
      throw new AppHttpException('INTERNAL_ERROR', 'Failed to create user');
    }

    const sessionToken = await this.createSession(user.id);
    await this.dbService.db.insert(auditEvents).values({
      userId: user.id,
      action: 'auth.register',
      resourceType: 'user',
      resourceId: user.id,
      requestId: meta.requestId,
      metadata: {},
    });

    return { user: this.toPublic(user), sessionToken };
  }

  async login(
    raw: LoginRequest,
    meta: { requestId?: string },
  ): Promise<{ user: UserPublic; sessionToken: string }> {
    const input = LoginRequestSchema.parse(raw);
    const email = input.email.toLowerCase();
    const user = await this.dbService.db.query.users.findFirst({
      where: eq(users.email, email),
    });

    const invalid = () =>
      new AppHttpException('UNAUTHORIZED', 'Invalid email or password');

    if (!user || user.status !== 'active') {
      throw invalid();
    }

    const ok = await verifyPassword(user.passwordHash, input.password);
    if (!ok) {
      throw invalid();
    }

    const sessionToken = await this.createSession(user.id);
    await this.dbService.db.insert(auditEvents).values({
      userId: user.id,
      action: 'auth.login',
      resourceType: 'user',
      resourceId: user.id,
      requestId: meta.requestId,
      metadata: {},
    });

    return { user: this.toPublic(user), sessionToken };
  }

  async logout(sessionToken: string | undefined): Promise<void> {
    if (!sessionToken) return;
    const tokenHash = hashToken(sessionToken);
    await this.dbService.db
      .update(sessions)
      .set({ revokedAt: new Date() })
      .where(eq(sessions.tokenHash, tokenHash));
  }

  async resolveUserFromSession(
    sessionToken: string | undefined,
  ): Promise<UserPublic | null> {
    if (!sessionToken) return null;
    const tokenHash = hashToken(sessionToken);
    const row = await this.dbService.db.query.sessions.findFirst({
      where: and(
        eq(sessions.tokenHash, tokenHash),
        isNull(sessions.revokedAt),
        gt(sessions.expiresAt, new Date()),
      ),
    });

    if (!row) return null;

    const user = await this.dbService.db.query.users.findFirst({
      where: eq(users.id, row.userId),
    });
    if (!user || user.status !== 'active') return null;
    return this.toPublic(user);
  }

  cookieOptions() {
    const secure = this.config.env.NODE_ENV === 'production';
    return {
      httpOnly: true,
      secure,
      sameSite: 'lax' as const,
      path: '/',
      maxAge: this.config.env.SESSION_TTL_SECONDS * 1000,
    };
  }

  cookieName(): string {
    return this.config.env.SESSION_COOKIE_NAME;
  }

  private async createSession(userId: string): Promise<string> {
    const token = generateOpaqueToken(32);
    const tokenHash = hashToken(token);
    const expiresAt = new Date(
      Date.now() + this.config.env.SESSION_TTL_SECONDS * 1000,
    );
    await this.dbService.db.insert(sessions).values({
      userId,
      tokenHash,
      expiresAt,
    });
    return token;
  }

  private toPublic(user: {
    id: string;
    email: string;
    displayName: string | null;
    createdAt: Date;
  }): UserPublic {
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      createdAt: user.createdAt.toISOString(),
    };
  }
}
