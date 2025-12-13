require('dotenv').config();

module.exports = {
  // Server
  port: process.env.PORT || 8000,
  nodeEnv: process.env.NODE_ENV || 'development',
  
  // Database
  database: {
    url: process.env.DATABASE_URL || 
      `mysql://${process.env.DB_USER || 'root'}:${process.env.DB_PASSWORD || ''}@${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 3306}/${process.env.DB_NAME || 'voting_system'}`,
  },
  
  // JWT
  jwt: {
    secret: process.env.JWT_SECRET_KEY || 'your-secret-key-change-in-production',
    algorithm: process.env.JWT_ALGORITHM || 'HS256',
    accessTokenExpireMinutes: parseInt(process.env.JWT_ACCESS_TOKEN_EXPIRE_MINUTES || '15'),
    refreshTokenExpireDays: parseInt(process.env.JWT_REFRESH_TOKEN_EXPIRE_DAYS || '7'),
  },
  
  // CORS
  cors: {
    origins: process.env.CORS_ORIGINS 
      ? process.env.CORS_ORIGINS.split(',').map(origin => origin.trim())
      : ['http://localhost:5173', 'http://localhost:3000'],
  },
  
  // Rate limiting
  rateLimit: {
    perMinute: parseInt(process.env.RATE_LIMIT_PER_MINUTE || '100'),
  },
  
  // Blockchain
  blockchain: {
    rpcUrl: process.env.BLOCKCHAIN_RPC_URL || 'http://localhost:8545',
    // Note: ADMIN_WALLET_PRIVATE_KEY env var name kept for backward compatibility
    // This is the system wallet used by owner/creator for contract operations
    adminWalletPrivateKey: process.env.ADMIN_WALLET_PRIVATE_KEY,
    adminWalletAddress: process.env.ADMIN_WALLET_ADDRESS || '0xbc5575790975F2C963AbECA62f9eAEb8c3aB073A',
  },
  
  // IPFS
  ipfs: {
    apiUrl: process.env.IPFS_API_URL || 'http://localhost:5001',
    gatewayUrl: process.env.IPFS_GATEWAY_URL || 'https://ipfs.io/ipfs/',
    // Pinata configuration
    pinata: {
      enabled: process.env.PINATA_ENABLED === 'true' || !!process.env.PINATA_JWT || (!!process.env.PINATA_API_KEY && !!process.env.PINATA_API_SECRET),
      jwt: process.env.PINATA_JWT,
      apiKey: process.env.PINATA_API_KEY,
      apiSecret: process.env.PINATA_API_SECRET,
      gatewayUrl: process.env.PINATA_GATEWAY_URL || 'https://gateway.pinata.cloud/ipfs/',
    },
  },
  
  // SMTP (optional)
  smtp: {
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    user: process.env.SMTP_USER,
    password: process.env.SMTP_PASSWORD,
    from: process.env.EMAIL_FROM,
  },
};

