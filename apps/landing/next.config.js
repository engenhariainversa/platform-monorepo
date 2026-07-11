/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@repo/ui", "@repo/graphql", "@repo/types"],
};

module.exports = nextConfig;
