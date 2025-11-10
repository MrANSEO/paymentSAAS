// src/services/notificationService.js
const axios = require('axios');
const crypto = require('crypto');

class NotificationService {
  // Envoi de SMS (simulation en dev)
  async sendPaymentConfirmation(phone, amount, reference) {
    console.log(`📱 [SMS SIMULÉ] Envoyé à ${phone}: "Veuillez confirmer le paiement de ${amount} FCFA. Réf: ${reference}"`);
    return { success: true };
  }

  async sendPaymentSuccess(phone, amount, reference) {
    console.log(`✅ [SMS SIMULÉ] Succès à ${phone}: "Paiement de ${amount} FCFA confirmé. Réf: ${reference}"`);
    return { success: true };
  }

  async sendPaymentFailure(phone, amount, reference, reason = 'Échec du paiement') {
    console.log(`❌ [SMS SIMULÉ] Échec à ${phone}: "Paiement de ${amount} FCFA échoué. Raison: ${reason}. Réf: ${reference}"`);
    return { success: true };
  }

  // 🔑 ENVOI WEBHOOK AU MARCHAND (essentiel)
  async notifyMerchant(webhookUrl, payload) {
    if (!webhookUrl) {
      console.warn('⚠️ Webhook URL absente → notification ignorée');
      return { success: false, error: 'Webhook URL manquante' };
    }

    // utiliser une clé interne pour signer les notifications vers les marchands
    const secret = process.env.INTERNAL_WEBHOOK_SECRET || process.env.MESOMB_SECRET_KEY;
    const body = JSON.stringify(payload);
    const signature = crypto.createHmac('sha256', secret).update(body).digest('hex');

    try {
      console.log(`📡 Envoi webhook à: ${webhookUrl}`);
      console.log('📦 Payload:', JSON.stringify(payload, null, 2));

      const response = await axios.post(webhookUrl, payload, {
        headers: {
          'Content-Type': 'application/json',
          'x-merchant-signature': signature,
          // optional: include app-specific api key if merchant expects it
          'x-api-key': process.env.INTERNAL_API_KEY || ''
        },
        timeout: 5000
      });

      console.log(`✅ Webhook reçu par le marchand (status: ${response.status})`);
      return { success: true, status: response.status };
    } catch (error) {
      console.error(`❌ Échec webhook → ${error.message}`);
      // retourner l'erreur pour que l'appelant puisse agir
      return { success: false, error: error.message };
    }
  }
}

module.exports = new NotificationService();