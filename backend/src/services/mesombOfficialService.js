// ✅ CORRECTION : src/services/mesombOfficialService.js
const { PaymentOperation } = require('@hachther/mesomb');

class MeSombOfficialService {
  constructor() {
    this.applicationKey = process.env.MESOMB_APP_KEY;
    this.accessKey = process.env.MESOMB_API_KEY;
    this.secretKey = process.env.MESOMB_SECRET_KEY;

    // ✅ AJOUT : Vérification des clés au démarrage
    if (!this.applicationKey || !this.accessKey || !this.secretKey) {
      console.error('❌ ERREUR : Clés MeSomb manquantes dans .env');
      console.error('  - MESOMB_APP_KEY:', this.applicationKey ? '✅' : '❌ MANQUANT');
      console.error('  - MESOMB_API_KEY:', this.accessKey ? '✅' : '❌ MANQUANT');
      console.error('  - MESOMB_SECRET_KEY:', this.secretKey ? '✅' : '❌ MANQUANT');
    } else {
      console.log('✅ MeSomb Service initialisé avec succès');
      console.log('  - APP_KEY:', this.applicationKey.substring(0, 10) + '...');
      console.log('  - API_KEY:', this.accessKey.substring(0, 10) + '...');
      console.log('  - SECRET_KEY:', this.secretKey.substring(0, 10) + '...');
    }
  }

  async makePayment(amount, phone, operator) {
    try {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('🚀 Appel à MeSomb (SDK officiel @hachther/mesomb)...');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('📞 Numéro:', phone);
      console.log('💰 Montant:', amount, 'XAF');
      console.log('📱 Opérateur reçu:', operator);

      // ✅ CORRECTION : Validation des paramètres
      if (!amount || amount < 10000) {
        return {
          success: false,
          error: 'Montant invalide (minimum 10000 XAF)'
        };
      }

      if (!phone || !/^237[0-9]{9}$/.test(phone)) {
        return {
          success: false,
          error: 'Numéro de téléphone invalide (format attendu: 237XXXXXXXXX)'
        };
      }

      // ✅ Création du client MeSomb
      const client = new PaymentOperation({
        applicationKey: this.applicationKey,
        accessKey: this.accessKey,
        secretKey: this.secretKey
      });

      // ✅ Le SDK MeSomb attend 'MTN' ou 'ORANGE'
      const service = operator === 'ORANGE' ? 'ORANGE' : 'MTN';
      console.log('🔧 Service mappé pour SDK MeSomb:', service);

      // ✅ Paramètres du paiement
      const paymentParams = {
        payer: phone,
        amount: amount,
        service: service,
        country: 'CM',
        currency: 'XAF'
      };

      console.log('📤 Paramètres envoyés à MeSomb:', JSON.stringify(paymentParams, null, 2));

      // ✅ Appel API MeSomb
      const response = await client.makeCollect(paymentParams);

      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('📥 Réponse MeSomb (brute):', JSON.stringify(response, null, 2));
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

      // ✅ Analyse de la réponse
      console.log('🔍 Analyse de la réponse:');
      console.log('  - isOperationSuccess():', response.isOperationSuccess ? response.isOperationSuccess() : 'N/A');
      console.log('  - isTransactionSuccess():', response.isTransactionSuccess ? response.isTransactionSuccess() : 'N/A');
      console.log('  - Transaction ID (pk):', response.transaction?.pk || 'N/A');
      console.log('  - Status:', response.transaction?.status || 'N/A');

      // ✅ IMPORTANT : Le statut final viendra du WEBHOOK
      // On retourne seulement si l'initiation a réussi
      if (response.isOperationSuccess && response.isOperationSuccess()) {
        if (response.isTransactionSuccess && response.isTransactionSuccess()) {
          console.log('✅ Paiement initié avec succès');
          console.log('⏳ Attente de la confirmation client et du webhook MeSomb...');

          return {
            success: true,
            data: {
              transactionId: response.transaction?.pk,
              message: 'Paiement initié avec succès',
              // ⚠️ Ne PAS renvoyer le statut ici, il viendra du webhook
            }
          };
        } else {
          console.log('❌ Transaction échouée (isTransactionSuccess = false)');
          return {
            success: false,
            error: 'Échec de l\'initiation du paiement (transaction failed)'
          };
        }
      } else {
        console.log('❌ Opération échouée (isOperationSuccess = false)');
        return {
          success: false,
          error: 'Échec de l\'initiation du paiement (operation failed)'
        };
      }

    } catch (error) {
      console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.error('❌ Erreur MeSomb (SDK officiel):', error.message);
      console.error('Stack:', error.stack);
      console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

      // ✅ Détails de l'erreur pour debug
      if (error.response) {
        console.error('📥 Réponse d\'erreur:', error.response.data);
      }

      return {
        success: false,
        error: error.message || 'Erreur lors de l\'appel à MeSomb'
      };
    }
  }

  // ✅ Méthode pour vérifier le statut (ne devrait PAS être utilisée - préférer le webhook)
  async checkTransactionStatus(transactionId) {
    try {
      console.log('🔍 Vérification statut MeSomb pour:', transactionId);
      console.log('⚠️ ATTENTION : Cette méthode ne devrait être utilisée qu\'en dernier recours');
      console.log('   Le statut DOIT venir du webhook pour être fiable');

      const client = new PaymentOperation({
        applicationKey: this.applicationKey,
        accessKey: this.accessKey,
        secretKey: this.secretKey
      });

      const transactions = await client.getTransactions([transactionId]);

      if (transactions && transactions.length > 0) {
        console.log('✅ Transaction trouvée:', JSON.stringify(transactions[0], null, 2));
        return {
          success: true,
          data: transactions[0]
        };
      } else {
        console.log('❌ Transaction non trouvée sur MeSomb');
        return {
          success: false,
          error: 'Transaction non trouvée'
        };
      }
    } catch (error) {
      console.error('❌ Erreur vérification statut MeSomb:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = new MeSombOfficialService();