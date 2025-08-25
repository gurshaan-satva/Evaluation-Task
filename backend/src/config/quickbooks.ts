import dotenv from 'dotenv';
dotenv.config(); 

export const quickbooksConfig = {
  clientId: process.env.CLIENT_ID || '',
  clientSecret: process.env.CLIENT_SECRET || '',
  redirectUri: process.env.REDIRECT_URI || '',
  authUrl : process.env.AUTH_URL || ' ',
  tokenUrl : process.env.TOKEN_URL || ' ',
  scopes: [
    'com.intuit.quickbooks.accounting',
    'openid',
    'profile',
    'email',
  ],
};
