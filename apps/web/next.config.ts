import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactCompiler: true,
  transpilePackages: ['@ferreteria/types', '@ferreteria/validation'],
};

export default nextConfig;
