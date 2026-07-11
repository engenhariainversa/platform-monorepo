/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@repo/ui", "@repo/graphql", "@repo/types"],
};

module.exports = nextConfig;
