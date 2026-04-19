import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { DataSource, Repository } from 'typeorm';
import {
  UserRole,
  WalletTransactionType,
} from '../../common/types/direction.enum';
import { User } from '../../entities/user.entity';
import { WalletTransaction } from '../../entities/wallet-transaction.entity';
import { Wallet } from '../../entities/wallet.entity';
import { SettingsService } from '../settings/settings.service';
import { UsersService } from '../users/users.service';
import type { LoginDto } from './dto/login.dto';
import type { SignupDto } from './dto/signup.dto';
import type { JwtPayload } from './types/jwt-payload';

export interface AuthResult {
  token: string;
  user: {
    id: string;
    email: string;
    full_name: string;
    first_name: string | null;
    last_name: string | null;
    avatar_url: string | null;
    role: UserRole;
    phone: string | null;
  };
}

/**
 * Splits a free-form display name into (first, last). Used when a
 * legacy client only sends `full_name`. Single-token names go entirely
 * into `last_name` (most cultures keep the family name on the right;
 * the user can fix it later via the profile screen).
 */
function splitFullName(input: string): { first: string; last: string } {
  const trimmed = input.trim();
  if (!trimmed) return { first: '', last: '' };
  const idx = trimmed.indexOf(' ');
  if (idx === -1) return { first: '', last: trimmed };
  return {
    first: trimmed.slice(0, idx).trim(),
    last: trimmed.slice(idx + 1).trim(),
  };
}

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly jwt: JwtService,
    private readonly settings: SettingsService,
    private readonly dataSource: DataSource,
  ) {}

  async signup(dto: SignupDto): Promise<AuthResult> {
    // Self-service signup is reserved for end users. Admins are bootstrapped
    // through env / CLI on the server, never through the public endpoint.
    if (dto.role === UserRole.ADMIN) {
      throw new ForbiddenException('Cannot self-register as admin');
    }

    const { first, last, full } = this.resolveNames(dto);
    if (!full) {
      throw new BadRequestException(
        'Le prénom et le nom sont requis pour créer un compte',
      );
    }

    const existing = await this.users.findOne({ where: { email: dto.email } });
    if (existing) throw new ConflictException('Email already registered');

    const password_hash = await bcrypt.hash(dto.password, 10);
    const initialBalance = this.settings.getNumber(
      'app.initialWalletBalanceXpf',
      10000,
    );

    const user = await this.dataSource.transaction(async (tx) => {
      const created = await tx.getRepository(User).save(
        tx.getRepository(User).create({
          email: dto.email,
          phone: dto.phone || null,
          password_hash,
          full_name: full,
          first_name: first || null,
          last_name: last || null,
          role: dto.role || UserRole.BOTH,
        }),
      );
      await tx.getRepository(Wallet).save(
        tx.getRepository(Wallet).create({
          user_id: created.id,
          balance_xpf: initialBalance,
        }),
      );
      await tx.getRepository(WalletTransaction).save(
        tx.getRepository(WalletTransaction).create({
          user_id: created.id,
          amount_xpf: initialBalance,
          type: WalletTransactionType.INITIAL,
          trip_id: null,
        }),
      );
      return created;
    });

    return this.issueToken(user);
  }

  private resolveNames(dto: SignupDto): {
    first: string;
    last: string;
    full: string;
  } {
    let first = dto.first_name?.trim() ?? '';
    let last = dto.last_name?.trim() ?? '';
    if ((!first || !last) && dto.full_name) {
      const split = splitFullName(dto.full_name);
      first = first || split.first;
      last = last || split.last;
    }
    const full = [first, last]
      .filter((s) => !!s && s.length > 0)
      .join(' ')
      .trim()
      .slice(0, 120);
    return { first, last, full };
  }

  async login(dto: LoginDto): Promise<AuthResult> {
    const user = await this.users.findOne({ where: { email: dto.email } });
    if (!user || user.deleted_at) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const ok = await bcrypt.compare(dto.password, user.password_hash);
    if (!ok) throw new UnauthorizedException('Invalid credentials');
    if (user.suspended_at) {
      throw new ForbiddenException('Account suspended');
    }
    return this.issueToken(user);
  }

  private issueToken(user: User): AuthResult {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };
    const token = this.jwt.sign(payload);
    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        first_name: user.first_name,
        last_name: user.last_name,
        avatar_url: UsersService.buildAvatarUrl(user.avatar_path),
        role: user.role,
        phone: user.phone,
      },
    };
  }
}
