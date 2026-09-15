import type * as Preset from "@docusaurus/preset-classic";
import type { Config } from "@docusaurus/types";

const config: Config = {
  title: "Alenexum",
  tagline:
    "Application framework for Discord bots, from small projects to enterprise-scale systems.",
  favicon: "img/favicon.ico",
  url: "https://matrovian.github.io",
  baseUrl: "/alenexum/",
  organizationName: "matrovian",
  projectName: "alenexum",
  onBrokenLinks: "throw",
  markdown: {
    hooks: {
      onBrokenMarkdownLinks: "throw",
    },
  },
  onDuplicateRoutes: "warn",
  trailingSlash: false,
  i18n: {
    defaultLocale: "en",
    locales: ["en"],
  },
  presets: [
    [
      "classic",
      {
        docs: {
          path: "../docs",
          routeBasePath: "/",
          sidebarPath: "./sidebars.ts",
          editUrl: undefined,
          showLastUpdateTime: false,
        },
        blog: false,
        theme: {
          customCss: "./src/css/custom.css",
        },
      } satisfies Preset.Options,
    ],
  ],
  themeConfig: {
    navbar: {
      title: "Alenexum",
      items: [
        { to: "/intro", label: "Docs", position: "left" },
        {
          to: "/getting-started/first-bot",
          label: "Getting Started",
          position: "left",
        },
        { to: "/api/core", label: "API", position: "left" },
        {
          to: "/architecture/enterprise-boundaries",
          label: "Enterprise",
          position: "left",
        },
      ],
    },
    footer: {
      style: "dark",
      links: [
        {
          title: "Docs",
          items: [
            { label: "Introduction", to: "/intro" },
            { label: "Getting Started", to: "/getting-started/first-bot" },
            { label: "API Reference", to: "/api/core" },
          ],
        },
        {
          title: "Operations",
          items: [
            { label: "Troubleshooting", to: "/guides/troubleshooting" },
            { label: "Production", to: "/guides/production" },
            { label: "Error Codes", to: "/reference/error-codes" },
          ],
        },
      ],
      copyright: `Alenexum docs. Built with Docusaurus.`,
    },
    prism: {
      additionalLanguages: ["bash", "diff", "json"],
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
