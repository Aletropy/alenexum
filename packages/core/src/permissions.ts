import type { BaseInteractionContext } from "./context.js";
import { defineGuard, type GuardObject } from "./guards.js";

/**
 * Permission guard factories. Bits are plain `bigint`s so core never imports
 * discord.js — apps pass `PermissionFlagsBits.X` through. All checks are
 * fail-closed: an unrecognized interaction shape denies, never allows.
 */
export interface PermissionGuardOptions {
  readonly message?: string | undefined;
}

function hasAll(perms: unknown, bits: bigint | readonly bigint[]): boolean {
  if (typeof perms !== "object" || perms === null) {
    return false;
  }
  const has = (perms as { has?: unknown }).has;
  if (typeof has !== "function") {
    return false;
  }
  try {
    const list = Array.isArray(bits) ? bits : [bits];
    return list.every(
      (bit) => (has as (bit: bigint) => boolean).call(perms, bit) === true,
    );
  } catch {
    return false;
  }
}

function hasAnyRole(raw: unknown, roleIds: readonly string[]): boolean {
  if (typeof raw !== "object" || raw === null) {
    return false;
  }
  const member = (raw as { member?: unknown }).member;
  if (typeof member !== "object" || member === null) {
    return false;
  }
  const roles = (member as { roles?: unknown }).roles;
  if (Array.isArray(roles)) {
    return (
      roles.every((role) => typeof role === "string") &&
      roleIds.some((id) => (roles as string[]).includes(id))
    );
  }
  if (typeof roles === "object" && roles !== null) {
    const cache = (roles as { cache?: unknown }).cache;
    if (typeof cache === "object" && cache !== null) {
      const has = (cache as { has?: unknown }).has;
      if (typeof has === "function") {
        try {
          return roleIds.some(
            (id) => (has as (key: string) => unknown).call(cache, id) === true,
          );
        } catch {
          return false;
        }
      }
      const keys = (cache as { keys?: unknown }).keys;
      if (typeof keys === "function") {
        try {
          const ids = [...(keys as () => Iterable<unknown>).call(cache)];
          return (
            ids.every((id) => typeof id === "string") &&
            roleIds.some((id) => (ids as string[]).includes(id))
          );
        } catch {
          return false;
        }
      }
    }
  }
  return false;
}

function interactionRecord(
  ctx: BaseInteractionContext,
): Record<string, unknown> {
  return typeof ctx.interaction === "object" && ctx.interaction !== null
    ? (ctx.interaction as Record<string, unknown>)
    : {};
}

/** Deny outside guilds (guildId is null in DMs). */
export function requireGuild(options?: PermissionGuardOptions): GuardObject {
  return defineGuard({
    name: "requireGuild",
    check: (ctx) =>
      ctx.guildId === null || ctx.guildId === undefined
        ? {
            allowed: false,
            message:
              options?.message ?? "This cannot be used in direct messages.",
          }
        : true,
  });
}

/** Require requester guild permissions (fail-closed when unreadable). */
export function requireUserPermissions(
  bits: bigint | readonly bigint[],
  options?: PermissionGuardOptions,
): GuardObject {
  return defineGuard({
    name: "requireUserPermissions",
    check: (ctx) =>
      hasAll(interactionRecord(ctx).memberPermissions, bits)
        ? true
        : {
            allowed: false,
            message:
              options?.message ??
              "You lack the permissions required to use this.",
          },
  });
}

/** Require the bot's own guild permissions (fail-closed when unreadable). */
export function requireBotPermissions(
  bits: bigint | readonly bigint[],
  options?: PermissionGuardOptions,
): GuardObject {
  return defineGuard({
    name: "requireBotPermissions",
    check: (ctx) =>
      hasAll(interactionRecord(ctx).appPermissions, bits)
        ? true
        : {
            allowed: false,
            message:
              options?.message ??
              "I lack the permissions required to run this.",
          },
  });
}

/** Require membership in any of the given roles (fail-closed when unreadable). */
export function requireRoles(
  roleIds: readonly string[],
  options?: PermissionGuardOptions,
): GuardObject {
  return defineGuard({
    name: "requireRoles",
    check: (ctx) =>
      hasAnyRole(ctx.interaction, roleIds)
        ? true
        : {
            allowed: false,
            message:
              options?.message ?? "You lack the roles required to use this.",
          },
  });
}

/** Owner-style allowlist on user ids. */
export function requireUserIds(
  userIds: readonly string[],
  options?: PermissionGuardOptions,
): GuardObject {
  return defineGuard({
    name: "requireUserIds",
    check: (ctx) =>
      ctx.userId !== undefined && userIds.includes(ctx.userId)
        ? true
        : {
            allowed: false,
            message: options?.message ?? "This is restricted.",
          },
  });
}
