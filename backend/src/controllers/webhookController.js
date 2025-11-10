// ✅ CORRECTION COMPLÈTE : src/controllers/webhookController.js
const crypto = require('crypto');
const Transaction = require('../models/Transaction');
const Merchant = require('../models/Merchant');
const NotificationService = require('../services/notificationService');

class WebhookController {
  // Accept both sha1 and sha256, hex or base64, remove prefices like "sha1=" or "sha256="
  verifySignature(payloadBuffer, signatureHeader, secret) {
    if (!payloadBuffer || !signatureHeader || !secret) return false;

    let sig = String(signatureHeader).trim();
    sig = sig.replace(/^(sha1=|sha256=|sha1:|sha256:)/i, '');

    const tryDecode = (alg, encoding) => {
      try {
        const computed = crypto.createHmac(alg, secret).update(payloadBuffer).digest();
        const sigBuf = Buffer.from(sig, encoding);
        if (sigBuf.length !== computed.length) return false;
        return crypto.timingSafeEqual(computed, sigBuf);
      } catch (e) {
        return false;
      }
    };

    // try hex/base64 with sha1 then sha256
    return tryDecode('sha1', 'hex') || tryDecode('sha1', 'base64') ||
           tryDecode('sha256', 'hex') || tryDecode('sha256', 'base64');
  }

  // nouvelle méthode pour vérifier signature interne marchand
  verifyInternalSignature(payloadBuffer, signatureHeader) {
    const secret = process.env.INTERNAL_WEBHOOK_SECRET || process.env.MESOMB_SECRET_KEY;
    if (!signatureHeader || !secret) return false;
    const sig = String(signatureHeader).trim();
    const computed = crypto.createHmac('sha256', secret).update(payloadBuffer).digest('hex');
    return crypto.timingSafeEqual(Buffer.from(computed, 'hex'), Buffer.from(sig, 'hex'));
  }

  async handleMeSombWebhook(req, res) {
    try {
      // prefer raw buffer
      const payloadBuffer = req.rawBody || (Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body || {})));

      // If request came from internal notifier, verify internal signature and ignore processing to avoid loops
      const internalSig = req.headers['x-internal-signature'];
      if (internalSig) {
        if (this.verifyInternalSignature(payloadBuffer, internalSig)) {
          console.log('⚠️ Requête interne reçue — ignorée pour éviter boucle');
          return res.status(200).json({ success: true, message: 'Internal notification ignored' });
        } else {
          console.warn('Requête interne avec signature invalide — rejetée');
          return res.status(401).json({ success: false, message: 'Internal signature invalid' });
        }
      }

      const signature =
        req.headers['x-signature'] ||
        req.headers['x-mesomb-signature'] ||
        req.headers['signature'] ||
        req.headers['x-hub-signature'];

      const secret = process.env.MESOMB_SECRET_KEY;

      // prefer rawBody set by express.raw middleware
      // const payloadBuffer = req.rawBody || (Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body || {})));

      // En production : exiger signature
      if (!signature || !secret) {
        console.warn('Webhook sans signature ou secret manquant', { signaturePresent: !!signature });
        return res.status(400).json({ success: false, message: 'Signature manquante' });
      }

      if (!this.verifySignature(payloadBuffer, signature, secret)) {
        console.warn('Signature invalide — rejet du webhook');
        return res.status(401).json({ success: false, message: 'Signature invalide' });
      }

      console.log('✅ Signature vérifiée');

      const payload = JSON.parse(payloadBuffer.toString());

      console.log('📦 Payload webhook:', JSON.stringify(payload, null, 2));

      const { pk, status, reference, amount, customer } = payload;

      if (!status || !reference) {
        console.log('❌ Données manquantes dans le webhook');
        return res.status(400).json({ success: false, message: 'Données manquantes' });
      }

      console.log('🔍 Recherche transaction:', { reference, pk });

      // Trouver la transaction dans la base de données
      const transaction = await Transaction.findOne({
        $or: [{ reference }, { mesomb_transaction_id: pk }]
      });

      if (!transaction) {
        console.log('❌ Transaction introuvable pour:', { reference, pk });
        return res.status(404).json({ success: false, message: 'Transaction introuvable' });
      }

      console.log('✅ Transaction trouvée:', transaction.reference);

      // Mapping des statuts MeSomb
      const statusMap = {
        SUCCESS: 'SUCCESS',
        FAILED: 'FAILED',
        PENDING: 'PENDING',
        REFUNDED: 'REFUNDED',
        EXPIRED: 'EXPIRED'
      };
      const newStatus = statusMap[status] || 'PENDING';

      console.log('🔄 Changement de statut:', transaction.status, '→', newStatus);

      // Mettre à jour la transaction si le statut a changé
      if (transaction.status !== newStatus) {
        await Transaction.findByIdAndUpdate(transaction._id, {
          status: newStatus,
          mesomb_transaction_id: pk || transaction.mesomb_transaction_id
        });
        console.log(`✅ Statut mis à jour: ${transaction.reference} → ${newStatus}`);
      } else {
        console.log('ℹ️ Statut inchangé, aucune mise à jour nécessaire');
      }

      // Notification du client
      if (newStatus === 'SUCCESS') {
        await NotificationService.sendPaymentSuccess(
          transaction.customer_phone,
          transaction.amount,
          transaction.reference
        );
      } else if (newStatus === 'FAILED') {
        await NotificationService.sendPaymentFailure(
          transaction.customer_phone,
          transaction.amount,
          transaction.reference
        );
      }

      // Notification du marchand via son webhook
      if (transaction.merchant_id) {
        const merchant = await Merchant.findById(transaction.merchant_id);
        if (merchant?.webhook_url) {
          console.log('📡 Envoi webhook au marchand:', merchant.webhook_url);
          const webhookPayload = {
            event: 'payment.updated',
            data: {
              reference: transaction.reference,
              amount: transaction.amount,
              currency: transaction.currency || 'XAF',
              customer_phone: transaction.customer_phone,
              status: newStatus,
              operator: transaction.operator,
              mesomb_transaction_id: pk,
              timestamp: new Date().toISOString()
            }
          };
          try {
            await NotificationService.notifyMerchant(merchant.webhook_url, webhookPayload);
            console.log('✅ Marchand notifié avec succès');
          } catch (err) {
            console.error('❌ Erreur lors de la notification du marchand:', err);
          }
        } else {
          console.log('ℹ️ Pas de webhook_url configuré pour le marchand');
        }
      }

      return res.status(200).json({ success: true, message: 'Webhook traité avec succès' });
    } catch (err) {
      console.error('❌ Erreur webhook:', err);
      return res.status(500).json({ success: false, message: 'Erreur serveur', error: err.message });
    }
  }
}

// ✅ Binding obligatoire pour préserver `this`
const instance = new WebhookController();
module.exports = {
  handleMeSombWebhook: instance.handleMeSombWebhook.bind(instance)
};