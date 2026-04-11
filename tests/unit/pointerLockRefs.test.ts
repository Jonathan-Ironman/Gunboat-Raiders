import { describe, it, expect, beforeEach } from 'vitest';
import {
  getIsPointerLocked,
  setIsPointerLocked,
  resetPointerLockRefs,
} from '@/systems/pointerLockRefs';

describe('pointerLockRefs', () => {
  beforeEach(() => {
    resetPointerLockRefs();
  });

  it('defaults to false after reset', () => {
    expect(getIsPointerLocked()).toBe(false);
  });

  it('set to true is reflected by getter', () => {
    setIsPointerLocked(true);
    expect(getIsPointerLocked()).toBe(true);
  });

  it('set to false is reflected by getter', () => {
    setIsPointerLocked(true);
    setIsPointerLocked(false);
    expect(getIsPointerLocked()).toBe(false);
  });

  it('reset returns to false even after setting to true', () => {
    setIsPointerLocked(true);
    resetPointerLockRefs();
    expect(getIsPointerLocked()).toBe(false);
  });

  it('multiple set/reset cycles are idempotent', () => {
    setIsPointerLocked(true);
    setIsPointerLocked(true);
    expect(getIsPointerLocked()).toBe(true);

    resetPointerLockRefs();
    resetPointerLockRefs();
    expect(getIsPointerLocked()).toBe(false);
  });
});
