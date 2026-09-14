/** Minimal structural fake of a discord.js chat-input interaction. */

export interface FakeInteractionOptions {
  commandName?: string;
  id?: string;
  guildId?: string | null;
  channelId?: string | null;
  userId?: string;
  chatInput?: boolean;
  failReply?: boolean;
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
  private readonly chatInput: boolean;

  constructor(options: FakeInteractionOptions = {}) {
    this.commandName = options.commandName ?? "ping";
    this.id = options.id ?? "interaction-1";
    this.guildId = options.guildId ?? "guild-1";
    this.channelId = options.channelId ?? "channel-1";
    if (options.userId !== undefined) {
      this.user = { id: options.userId };
    }
    this.chatInput = options.chatInput ?? true;
    this.failReply = options.failReply ?? false;
  }

  isChatInputCommand(): boolean {
    return this.chatInput;
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
}

export function createFakeInteraction(
  options: FakeInteractionOptions = {},
): FakeInteraction {
  return new FakeInteraction(options);
}
