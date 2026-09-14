import { defineModule } from "@discord-framework/core";
import { helloCommand } from "../commands/hello.js";

/** Feature module: owns a service plus the commands built on it. */
export const greetingsModule = defineModule({
  name: "greetings",
  setup: (host) => {
    host.services.register("greeter", (name: string) => `Hello, ${name}!`);
    host.command(helloCommand);
  },
});
