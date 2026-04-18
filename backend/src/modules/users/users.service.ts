import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../entities/user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  async getProfile(userId: string) {
    const user = await this.users.findOne({
      where: { id: userId },
      relations: { vehicles: true, wallet: true },
    });
    if (!user) throw new NotFoundException('User not found');
    const { password_hash: _, ...rest } = user;
    void _;
    return rest;
  }
}
