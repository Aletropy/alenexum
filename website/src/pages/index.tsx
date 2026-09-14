import Link from "@docusaurus/Link";
import useDocusaurusContext from "@docusaurus/useDocusaurusContext";
import Layout from "@theme/Layout";
import type React from "react";

export default function Home(): React.JSX.Element {
  const { siteConfig } = useDocusaurusContext();
  return (
    <Layout title={siteConfig.title} description={siteConfig.tagline}>
      <main style={{ padding: "4rem 2rem", maxWidth: 960, margin: "0 auto" }}>
        <h1>Nexum</h1>
        <p>{siteConfig.tagline}</p>
        <p>
          Nexum is an application framework for Discord bots. discord.js owns
          the network; Nexum owns application architecture: lifecycle, routing,
          middleware, registries, modules, plugins, config, logging,
          diagnostics, and testing.
        </p>
        <div style={{ display: "flex", gap: "1rem" }}>
          <Link className="button button--primary button--lg" to="/intro">
            Read the docs
          </Link>
          <Link
            className="button button--secondary button--lg"
            to="/getting-started/first-bot"
          >
            Build your first bot
          </Link>
        </div>
      </main>
    </Layout>
  );
}
