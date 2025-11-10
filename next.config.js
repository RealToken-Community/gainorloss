/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },
  webpack: (config) => {
    // Ignorer complètement le dossier subgraph
    config.resolve.alias = {
      ...config.resolve.alias,
      '@graphprotocol/graph-ts': false,
    };
    
    config.module.rules.push({
      test: /\.(ts|tsx|js|jsx)$/,
      exclude: /subgraph/,
    });
    
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
    };
    return config;
  },
  onDemandEntries: {
    maxInactiveAge: 60 * 1000,
    pagesBufferLength: 5,
  },
}

module.exports = nextConfig 