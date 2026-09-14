/**
 * Structural fakes of discord.js interactions for unit and integration
 * tests. No network, no client, deterministic. For full dispatch flows see
 * `./harness.js`.
 */

export interface FakeInteractionOptions {
  commandName?: string;
  id?: string;
  guildId?: string | null;
  channelId?: string | null;
  userId?: string;
  chatInput?: boolean;
  failReply?: boolean;
  /** Raw option values by name, served through a structural resolver fake. */
  optionValues?: Record<string, unknown> | undefined;
  focused?: { name: string; value: string | number } | undefined;
  customId?: string | undefined;
  values?: string[] | undefined;
  fieldValues?: Record<string, string> | undefined;
  targetId?: string | undefined;
  targetUser?: unknown;
  targetMessage?: unknown;
  /** Granted permission bits; absent entirely when undefined (fail-closed). */
  memberPermissions?: bigint[] | undefined;
  appPermissions?: bigint[] | undefined;
  /** Array-shaped member roles. */
  memberRoles?: string[] | undefined;
  /** Role-manager-shaped member roles ({ cache: { has, keys } }). */
  memberRoleCache?: string[] | undefined;
  /** Keys-only role cache ({ cache: { keys } }, no has). */
  memberRoleKeysOnly?: string[] | undefined;
  kinds?:
    | {
        button?: boolean | undefined;
        stringSelect?: boolean | undefined;
        userSelect?: boolean | undefined;
        roleSelect?: boolean | undefined;
        mentionableSelect?: boolean | undefined;
        channelSelect?: boolean | undefined;
        anySelect?: boolean | undefined;
        modal?: boolean | undefined;
        autocomplete?: boolean | undefined;
        userMenu?: boolean | undefined;
        messageMenu?: boolean | undefined;
      }
    | undefined;
}

/** Structural fake of discord.js `CommandInteractionOptionResolver`. */
export class FakeOptionResolver {
  focused: { name: string; value: string | number } | undefined;

  constructor(private readonly values: Record<string, unknown> = {}) {}

  private get(name: string): unknown {
    return Object.hasOwn(this.values, name) ? this.values[name] : null;
  }

  getString(name: string): string | null {
    const value = this.get(name);
    return typeof value === "string" ? value : null;
  }

  getInteger(name: string): number | null {
    const value = this.get(name);
    return typeof value === "number" ? value : null;
  }

  getNumber(name: string): number | null {
    const value = this.get(name);
    return typeof value === "number" ? value : null;
  }

  getBoolean(name: string): boolean | null {
    const value = this.get(name);
    return typeof value === "boolean" ? value : null;
  }

  getUser(name: string): unknown {
    return this.get(name);
  }

  getChannel(name: string): unknown {
    return this.get(name);
  }

  getRole(name: string): unknown {
    return this.get(name);
  }

  getMentionable(name: string): unknown {
    return this.get(name);
  }

  getAttachment(name: string): unknown {
    return this.get(name);
  }

  getFocused(_full?: boolean): { name: string; value: string | number } {
    if (this.focused === undefined) {
      throw new Error("no focused option");
    }
    return this.focused;
  }
}

export class FakeInteraction {
  commandName: string;
  id: string;
  guildId: string | null;
  channelId: string | null;
  user = { id: "user-1" };
  replies: string[] = [];
  followUps: string[] = [];
  deferred = false;
  failReply: boolean;
  readonly options: FakeOptionResolver;
  readonly customId: string | undefined;
  readonly values: string[];
  readonly fields: { getTextInputValue(name: string): string };
  readonly targetId: string | undefined;
  readonly targetUser: unknown;
  readonly targetMessage: unknown;
  readonly memberPermissions:
    | { has(bits: bigint | bigint[]): boolean }
    | undefined;
  readonly appPermissions:
    | { has(bits: bigint | bigint[]): boolean }
    | undefined;
  readonly member:
    | {
        roles:
          | string[]
          | {
              cache: {
                has(role: string): boolean;
                keys(): IterableIterator<string>;
              };
            }
          | { cache: { keys(): IterableIterator<string> } };
      }
    | undefined;
  respondedChoices: unknown[] | undefined;
  updatedWith: string | undefined;
  deferredUpdate = false;
  private readonly kinds: NonNullable<FakeInteractionOptions["kinds"]>;
  private readonly chatInput: boolean;

  constructor(options: FakeInteractionOptions = {}) {
    this.commandName = options.commandName ?? "ping";
    this.id = options.id ?? "interaction-1";
    // Explicit null must survive (DM interactions have no guild).
    this.guildId = options.guildId === undefined ? "guild-1" : options.guildId;
    this.channelId =
      options.channelId === undefined ? "channel-1" : options.channelId;
    if (options.userId !== undefined) {
      this.user = { id: options.userId };
    }
    this.chatInput = options.chatInput ?? true;
    this.failReply = options.failReply ?? false;
    this.options = new FakeOptionResolver(options.optionValues ?? {});
    this.options.focused = options.focused;
    this.customId = options.customId;
    this.values = options.values ?? [];
    const fieldValues = options.fieldValues ?? {};
    this.fields = {
      getTextInputValue(name: string): string {
        if (!Object.hasOwn(fieldValues, name)) {
          throw new Error(`missing field: ${name}`);
        }
        return fieldValues[name] as string;
      },
    };
    this.targetId = options.targetId;
    this.targetUser = options.targetUser;
    this.targetMessage = options.targetMessage;
    const grantedMember = options.memberPermissions;
    this.memberPermissions =
      grantedMember === undefined
        ? undefined
        : {
            has: (bits) =>
              asArray(bits).every((bit) => grantedMember.includes(bit)),
          };
    const grantedApp = options.appPermissions;
    this.appPermissions =
      grantedApp === undefined
        ? undefined
        : {
            has: (bits) =>
              asArray(bits).every((bit) => grantedApp.includes(bit)),
          };
    if (options.memberRoles !== undefined) {
      this.member = { roles: options.memberRoles };
    } else if (options.memberRoleCache !== undefined) {
      const cached = options.memberRoleCache;
      this.member = {
        roles: {
          cache: {
            has: (role: string) => cached.includes(role),
            keys: () => cached.values(),
          },
        },
      };
    } else if (options.memberRoleKeysOnly !== undefined) {
      const cached = options.memberRoleKeysOnly;
      this.member = { roles: { cache: { keys: () => cached.values() } } };
    } else {
      this.member = undefined;
    }
    this.kinds = options.kinds ?? {};
  }

  isChatInputCommand(): boolean {
    return this.chatInput;
  }

  isButton(): boolean {
    return this.kinds.button ?? false;
  }

  isStringSelectMenu(): boolean {
    return this.kinds.stringSelect ?? false;
  }

  isUserSelectMenu(): boolean {
    return this.kinds.userSelect ?? false;
  }

  isRoleSelectMenu(): boolean {
    return this.kinds.roleSelect ?? false;
  }

  isMentionableSelectMenu(): boolean {
    return this.kinds.mentionableSelect ?? false;
  }

  isChannelSelectMenu(): boolean {
    return this.kinds.channelSelect ?? false;
  }

  isAnySelectMenu(): boolean {
    return this.kinds.anySelect ?? false;
  }

  isModalSubmit(): boolean {
    return this.kinds.modal ?? false;
  }

  isAutocomplete(): boolean {
    return this.kinds.autocomplete ?? false;
  }

  isUserContextMenuCommand(): boolean {
    return this.kinds.userMenu ?? false;
  }

  isMessageContextMenuCommand(): boolean {
    return this.kinds.messageMenu ?? false;
  }

  async reply(message: string): Promise<void> {
    if (this.failReply) {
      throw new Error("reply transport failure");
    }
    this.replies.push(message);
  }

  async deferReply(): Promise<void> {
    this.deferred = true;
  }

  async followUp(message: string): Promise<void> {
    this.followUps.push(message);
  }

  async update(message: string): Promise<void> {
    this.updatedWith = message;
  }

  async deferUpdate(): Promise<void> {
    this.deferredUpdate = true;
  }

  async respond(choices: unknown): Promise<void> {
    this.respondedChoices = choices as unknown[];
  }
}

export function createFakeInteraction(
  options: FakeInteractionOptions = {},
): FakeInteraction {
  return new FakeInteraction(options);
}

function asArray(bits: bigint | bigint[]): bigint[] {
  return Array.isArray(bits) ? bits : [bits];
}

type NonCommandOptions = Omit<
  FakeInteractionOptions,
  "chatInput" | "kinds" | "commandName"
>;

export type { NonCommandOptions };

/** Chat-input interaction (the default kind). */
export function chatInputInteraction(
  commandName: string,
  options: Omit<
    FakeInteractionOptions,
    "chatInput" | "kinds" | "commandName"
  > = {},
): FakeInteraction {
  return createFakeInteraction({ ...options, commandName, chatInput: true });
}

/** Button interaction for `customId`. */
export function buttonInteraction(
  customId: string,
  options: NonCommandOptions = {},
): FakeInteraction {
  return createFakeInteraction({
    ...options,
    chatInput: false,
    customId,
    kinds: { button: true },
  });
}

/** String-select interaction with selected `values`. */
export function selectInteraction(
  customId: string,
  values: string[] = [],
  options: NonCommandOptions = {},
): FakeInteraction {
  return createFakeInteraction({
    ...options,
    chatInput: false,
    customId,
    values,
    kinds: { stringSelect: true },
  });
}

/** Modal-submit interaction with submitted text inputs. */
export function modalInteraction(
  customId: string,
  fieldValues: Record<string, string> = {},
  options: NonCommandOptions = {},
): FakeInteraction {
  return createFakeInteraction({
    ...options,
    chatInput: false,
    customId,
    fieldValues,
    kinds: { modal: true },
  });
}

/** Autocomplete interaction with a focused option. */
export function autocompleteInteraction(
  commandName: string,
  focused: { name: string; value: string | number },
  optionValues: Record<string, unknown> = {},
  options: NonCommandOptions = {},
): FakeInteraction {
  return createFakeInteraction({
    ...options,
    commandName,
    chatInput: false,
    focused,
    optionValues,
    kinds: { autocomplete: true },
  });
}

/** User or message context-menu interaction. */
export function contextMenuInteraction(
  type: "user" | "message",
  name: string,
  options: NonCommandOptions = {},
): FakeInteraction {
  return createFakeInteraction({
    ...options,
    commandName: name,
    chatInput: false,
    kinds: type === "user" ? { userMenu: true } : { messageMenu: true },
  });
}
