/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",

  reactStrictMode: true,

  images: {
    unoptimized: true,
  },

  typescript: {
    tsconfigPath: "./tsconfig.next.json",
  },
};

module.exports = nextConfig;
