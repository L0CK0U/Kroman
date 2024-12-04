const axios = require('axios');
const { TOTP, Secret } = require('otpauth');
const config = require('../config');
const noblox = require('noblox.js');

const secret = config.roblox.secret;

if (!secret) {

  throw new Error('ROBLOX_SECRET is not defined');

}

const totp = new TOTP({

  issuer: 'Roblox',
  label: 'LockouDev',
  algorithm: 'SHA1',
  digits: 6,
  period: 30,
  secret: Secret.fromBase32(secret),

});

const clienteRoblox = axios.create({

  headers: {

    'Cookie': `.ROBLOSECURITY=${config.roblox.token}`,
    'Content-Type': 'application/json',
    withCredentials: true,

  },

});

// Função para obter o CSRF token
async function obterTokenCSRF() {

  try {

    const response = await clienteRoblox.post('https://auth.roblox.com/v2/logout');

    console.log('✅ CSRF token obtido:', config.roblox.csrf);

  } catch (error) {

    if (error.response && error.response.status === 401) {

      console.log('❌ Erro ao obter CSRF token:', error.message);

      process.exit(0);

    }

  }

}

// Função para validar o código 2FA
async function verifyTwoFactorCode(userId, verificationToken, challengeId) {

  const url = `https://twostepverification.roblox.com/v1/users/${userId}/challenges/authenticator/verify`;

  const body = {

    verificationToken: verificationToken,
    challengeId: challengeId,

  };

  try {

    const response = await clienteRoblox.post(url, body, {

      headers: { 'X-CSRF-TOKEN': config.roblox.csrf },

    });

    console.log('✅ Código 2FA verificado com sucesso:', response.data);
    console.log('🚨 Challenge ID verificado:', challengeId);

    return response.data;

  } catch (error) {

    console.error('❌ Erro ao verificar código 2FA:', error.response?.data || error.message);

    throw error;

  }

}

// Função para gerar código 2FA
function generateTwoFactorCode() {

  return totp.generate();

}

// Função para validar o código 2FA
function validateCode(code) {

  return totp.validate({ token: code, window: 1 }) !== null;

}

// Função de pagamento já implementada no noblox.js (não precisa de modificação)
async function tryPayment(amount, groupId, username) {

  const paymentResult = await noblox.groupPayout({

    group: groupId,
    member: await noblox.getIdFromUsername(username),
    amount: amount,

  });

  if (paymentResult.status === 'pending') {

    console.log('🚨 Pagamento pendente! Challenge ID gerado:', paymentResult.challengeId);

  }

  return paymentResult;

}

// Autenticação de 2FA com o Roblox usando a função de autenticação do noblox
async function authenticateTwoFactor() {

  const roblox2FACode = generateTwoFactorCode();

  console.log(`🔑 Código 2FA gerado automaticamente: ${roblox2FACode}`);

  const isValid = validateCode(roblox2FACode);

  if (isValid) {

    console.log('✅ Código 2FA validado com sucesso');

  } else {

    console.log('❌ Código 2FA inválido');

    return false;

  }

  // Se o código for válido, autentica no Roblox via noblox
  await noblox.setCookie(config.roblox.token);

  return true;

}

module.exports = {

  obterTokenCSRF,
  generateTwoFactorCode,
  validateCode,
  tryPayment,
  authenticateTwoFactor,
  verifyTwoFactorCode

};