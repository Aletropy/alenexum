import { defineGuard } from "../../../../src/index.js";

export default defineGuard({
  name: "allow-all",
  check: () => true,
});
