import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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
import type { LoginDto } from './dto/login.dto';
import type { SignupDto } from './dto/signup.dto';
import type { JwtPayload } from './types/jwt-payload';

export interface AuthResult {
  token: string;
  user: {
    id: string;
    email: string;
    full_name: string;
    role: UserRole;
    phone: string | null;
  };
}

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly dataSource: DataSource,
  ) {}

  async signup(dto: SignupDto): Promise<AuthResult> {
    const existing = await this.users.findOne({ where: { email: dto.email } });
    if (existing) throw new ConflictException('Email already registered');

    const password_hash = await bcrypt.hash(dto.password, 10);
    const initialBalance = this.config.get<number>(
      'app.initialWalletBalanceXpf',
      10000,
    );

    const user = await this.dataSource.transaction(async (tx) => {
      const created = await tx.getRepository(User).save(
        tx.getRepository(User).create({
          email: dto.email,
          phone: dto.phone || null,
          password_hash,
          full_name: dto.full_name,
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

  async login(dto: LoginDto): Promise<AuthResult> {
    const user = await this.users.findOne({ where: { email: dto.email } });
    if (!user) throw new UnauthorizedException('Invalid credentials');
    const ok = await bcrypt.compare(dto.password, user.password_hash);
    if (!ok) throw new UnauthorizedException('Invalid credentials');
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
        role: user.role,
        phone: user.phone,
      },
    };
  }
}
