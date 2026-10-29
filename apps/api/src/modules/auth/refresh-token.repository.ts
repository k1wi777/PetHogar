import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { RefreshToken } from './entities/refresh-token.entity';

@Injectable()
export class RefreshTokenRepository {
  constructor(@InjectRepository(RefreshToken) private readonly tokens: Repository<RefreshToken>) {}

  private en(manager?: EntityManager): Repository<RefreshToken> {
    return manager?.getRepository(RefreshToken) ?? this.tokens;
  }

  async crear(
    usuarioId: number,
    tokenHash: string,
    expiraEn: Date,
    manager?: EntityManager,
  ): Promise<void> {
    await this.en(manager).insert({ usuarioId, tokenHash, expiraEn });
  }

  buscarPorHash(tokenHash: string): Promise<RefreshToken | null> {
    return this.tokens.findOne({ where: { tokenHash } });
  }

  /** Atómico: de dos revocaciones simultáneas del mismo token solo una devuelve `true`. */
  async revocarSiActivo(id: number, manager?: EntityManager): Promise<boolean> {
    const r = await this.en(manager).update({ id, revocado: false }, { revocado: true });
    return (r.affected ?? 0) > 0;
  }

  async revocarPorHash(tokenHash: string): Promise<void> {
    await this.tokens.update({ tokenHash, revocado: false }, { revocado: true });
  }

  async revocarTodosDeUsuario(usuarioId: number, manager?: EntityManager): Promise<void> {
    await this.en(manager).update({ usuarioId, revocado: false }, { revocado: true });
  }
}
