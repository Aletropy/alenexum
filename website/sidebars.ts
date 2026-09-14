import type { SidebarsConfig } from "@docusaurus/plugin-content-docs";

const sidebars: SidebarsConfig = {
  docs: [
    "intro",
    {
      type: "category",
      label: "Getting Started",
      items: [
        "getting-started/installation",
        "getting-started/first-bot",
        "getting-started/sandbox-tour",
      ],
    },
    {
      type: "category",
      label: "Fundamentals",
      items: [
        "fundamentals/application-lifecycle",
        "fundamentals/routing-dispatch",
        "fundamentals/context",
        "fundamentals/commands-options",
        "fundamentals/interactions",
        "fundamentals/middleware-guards",
        "fundamentals/modules-plugins",
        "fundamentals/services-di",
        "fundamentals/configuration",
        "fundamentals/logging",
        "fundamentals/errors",
      ],
    },
    {
      type: "category",
      label: "Guides",
      items: [
        "guides/deploy-commands",
        "guides/permissions",
        "guides/cooldowns",
        "guides/background-jobs",
        "guides/health-metrics",
        "guides/sharding",
        "guides/testing",
        "guides/bulk-loading",
        "guides/troubleshooting",
        "guides/production",
      ],
    },
    {
      type: "category",
      label: "Architecture",
      items: [
        "architecture/small-app",
        "architecture/growing-app",
        "architecture/large-app",
        "architecture/enterprise-boundaries",
        "architecture/evolution",
        "architecture/limitations",
        "architecture/anti-patterns",
        {
          type: "category",
          label: "Decisions",
          items: [
            "architecture/decisions/framework-boundary",
            "architecture/decisions/routing",
            "architecture/decisions/plugin-module-namespace",
          ],
        },
      ],
    },
    {
      type: "category",
      label: "API Reference",
      items: [
        "api/core",
        "api/discord",
        "api/testing",
        "api/telemetry",
        "api/jobs",
        "api/sharding",
        "api/reserved",
      ],
    },
    {
      type: "category",
      label: "Reference",
      items: [
        "reference/configuration",
        "reference/error-codes",
        "reference/environment-variables",
        "reference/compatibility",
      ],
    },
    {
      type: "category",
      label: "Migration",
      items: ["migration/versioning", "migration/changelog"],
    },
    "contributing",
  ],
};

export default sidebars;
