import { defineCommand, userOption } from "@alenexum/core";

export const userinfoCommand = defineCommand({
  name: "userinfo",
  description: "Shows a user's id",
  options: {
    target: userOption({ description: "User to inspect", required: true }),
  },
  async execute(ctx) {
    await ctx.reply(`User id: ${ctx.options.target.id}`);
  },
});

export default userinfoCommand;
