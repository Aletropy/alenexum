import {
  defineCommand,
  defineModule,
  stringOption,
} from "@nexum/core";

/** Provided by the greetings module; the handler only knows the service key. */
export const helloCommand = defineCommand({
  name: "hello",
  description: "Greet someone via the greeter service",
  options: {
    name: stringOption({ description: "Who to greet" }),
  },
  async execute(ctx) {
    const greeter = ctx.services.get<(name: string) => string>("greeter");
    await ctx.reply(greeter(ctx.options.name ?? "world"));
  },
});

/** Feature module: owns a service plus the commands built on it. */
export const greetingsModule = defineModule({
  name: "greetings",
  setup: (host) => {
    host.services.register("greeter", (name: string) => `Hello, ${name}!`);
    host.command(helloCommand);
  },
});

export default greetingsModule;
