import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { LobbyError, RoomsService } from './rooms.service';

const code = (fn: () => unknown) => {
  try {
    fn();
  } catch (e) {
    return e instanceof LobbyError ? e.code : 'OTHER';
  }
  return 'NONE';
};

describe('RoomsService', () => {
  it('creates, joins, syncs and migrates host', () => {
    const s = new RoomsService();
    const room = s.create('a', { name: 'Ops', playerName: 'Alpha' });
    expect(s.list()).toHaveLength(1);
    s.join('b', { roomId: room.id, playerName: 'Bravo' });
    expect(s.get(room.id).players.map((p) => p.name)).toEqual(['Alpha', 'Bravo']);
    s.leave('a');
    expect(s.get(room.id).hostId).toBe('b');
    s.leave('b');
    expect(s.count()).toBe(0);
  });

  it('enforces host permissions, passwords, capacity and payload validation', () => {
    const s = new RoomsService();
    const room = s.create('a', { name: 'Private', playerName: 'A', isPrivate: true, password: 'pw' });
    expect(s.list()).toHaveLength(0);
    expect(code(() => s.join('b', { roomId: room.id, playerName: 'B', password: 'x' }))).toBe('BAD_PASSWORD');
    s.join('b', { roomId: room.id, playerName: 'B', password: 'pw' });
    expect(code(() => s.addBot('b', {}))).toBe('NOT_HOST');
    expect(code(() => s.setFaction('b', 'martians'))).toBe('INVALID_PAYLOAD');
    s.addBot('a', { faction: 'iron', difficulty: 'hard', personality: 'fortress' });
    s.addBot('a', {});
    expect(code(() => s.addBot('a', {}))).toBe('ROOM_FULL');
    expect(code(() => s.create('c', { name: '', playerName: 'C' }))).toBe('INVALID_PAYLOAD');
  });

  it('starts only when everyone is ready and an enemy team exists', () => {
    const s = new RoomsService();
    const room = s.create('a', { name: 'R', playerName: 'A' });
    s.join('b', { roomId: room.id, playerName: 'B' });
    expect(code(() => s.start('a'))).toBe('NOT_ALL_READY');
    s.setReady('b', true);
    expect(code(() => s.start('a'))).toBe('INVALID_PAYLOAD');
    s.addBot('a', { team: 1 });
    expect(s.start('a').status).toBe('loading');
  });
});
