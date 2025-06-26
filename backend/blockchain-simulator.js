// blockchain-simulator.js
// Simulateur de blockchain visuel pour AUCTA V1

const EventEmitter = require('events');

class AuctaBlockchainSimulator extends EventEmitter {
  constructor() {
    super();
    
    // État de la blockchain
    this.chain = [];
    this.currentBlock = null;
    this.pendingTransactions = [];
    this.miningInterval = 15000; // 15 secondes par bloc
    this.difficulty = 2;
    this.miningReward = 100;
    this.isRunning = false;
    
    // Statistiques
    this.stats = {
      totalTransactions: 0,
      totalClients: 0,
      totalPassports: 0,
      totalSBTs: 0,
      gasUsed: 0,
      averageBlockTime: 15
    };
    
    // Genesis block
    this.createGenesisBlock();
  }

  createGenesisBlock() {
    const genesisBlock = {
      index: 0,
      timestamp: new Date('2024-01-01').toISOString(),
      transactions: [{
        type: 'GENESIS',
        data: {
          message: 'AUCTA Blockchain Genesis Block',
          network: 'AUCTA Private Network',
          version: '1.0.0'
        }
      }],
      previousHash: '0',
      hash: this.calculateHash(0, new Date('2024-01-01').toISOString(), [], '0'),
      nonce: 0,
      miner: 'AUCTA Network'
    };
    
    this.chain.push(genesisBlock);
  }

  start() {
    if (this.isRunning) return;
    
    this.isRunning = true;
    console.log('⛏️  Blockchain simulator started');
    
    // Commencer le mining
    this.mineBlock();
    
    // Mining automatique
    this.miningTimer = setInterval(() => {
      if (this.pendingTransactions.length > 0 || Math.random() > 0.7) {
        this.mineBlock();
      }
    }, this.miningInterval);
    
    // Générer des transactions aléatoires pour la démo
    this.demoTimer = setInterval(() => {
      this.generateDemoTransaction();
    }, Math.random() * 10000 + 5000);
  }

  stop() {
    this.isRunning = false;
    clearInterval(this.miningTimer);
    clearInterval(this.demoTimer);
    console.log('🛑 Blockchain simulator stopped');
  }

  calculateHash(index, timestamp, transactions, previousHash, nonce = 0) {
    const crypto = require('crypto');
    const data = index + timestamp + JSON.stringify(transactions) + previousHash + nonce;
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  getLatestBlock() {
    return this.chain[this.chain.length - 1];
  }

  addTransaction(transaction) {
    // Valider la transaction
    if (!transaction.type || !transaction.data) {
      throw new Error('Invalid transaction format');
    }
    
    // Ajouter metadata
    transaction.id = 'tx_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    transaction.timestamp = new Date().toISOString();
    transaction.status = 'pending';
    transaction.gas = Math.floor(Math.random() * 50000) + 21000;
    
    this.pendingTransactions.push(transaction);
    this.stats.totalTransactions++;
    
    // Émettre l'événement
    this.emit('transactionAdded', transaction);
    
    console.log(`📝 New transaction: ${transaction.type}`);
    return transaction;
  }

  mineBlock() {
    if (!this.isRunning) return;
    
    const previousBlock = this.getLatestBlock();
    const newBlock = {
      index: previousBlock.index + 1,
      timestamp: new Date().toISOString(),
      transactions: [...this.pendingTransactions],
      previousHash: previousBlock.hash,
      nonce: 0,
      miner: 'AUCTA-Validator-' + Math.floor(Math.random() * 10)
    };
    
    // Simuler le Proof of Work
    console.log('⛏️  Mining new block...');
    const startTime = Date.now();
    
    while (newBlock.hash?.substring(0, this.difficulty) !== '0'.repeat(this.difficulty)) {
      newBlock.nonce++;
      newBlock.hash = this.calculateHash(
        newBlock.index,
        newBlock.timestamp,
        newBlock.transactions,
        newBlock.previousHash,
        newBlock.nonce
      );
    }
    
    const miningTime = Date.now() - startTime;
    newBlock.miningTime = miningTime;
    newBlock.gasUsed = newBlock.transactions.reduce((sum, tx) => sum + (tx.gas || 0), 0);
    
    // Ajouter le bloc à la chaîne
    this.chain.push(newBlock);
    
    // Mettre à jour les transactions
    this.pendingTransactions.forEach(tx => {
      tx.status = 'confirmed';
      tx.blockNumber = newBlock.index;
      tx.blockHash = newBlock.hash;
    });
    
    // Vider les transactions en attente
    this.pendingTransactions = [];
    
    // Mettre à jour les stats
    this.updateStats(newBlock);
    
    // Émettre l'événement
    this.emit('blockMined', newBlock);
    
    console.log(`✅ Block #${newBlock.index} mined in ${miningTime}ms with ${newBlock.transactions.length} transactions`);
    
    return newBlock;
  }

  updateStats(block) {
    block.transactions.forEach(tx => {
      switch (tx.type) {
        case 'CLIENT_REGISTERED':
          this.stats.totalClients++;
          break;
        case 'PASSPORT_CREATED':
          this.stats.totalPassports++;
          break;
        case 'SBT_MINTED':
          this.stats.totalSBTs++;
          break;
      }
    });
    
    this.stats.gasUsed += block.gasUsed || 0;
    this.stats.averageBlockTime = Math.round(
      (this.stats.averageBlockTime + (block.miningTime / 1000)) / 2
    );
  }

  generateDemoTransaction() {
    const types = ['CLIENT_REGISTERED', 'PASSPORT_CREATED', 'PASSPORT_ASSIGNED', 'SBT_MINTED'];
    const type = types[Math.floor(Math.random() * types.length)];
    
    let transaction;
    switch (type) {
      case 'CLIENT_REGISTERED':
        transaction = {
          type,
          data: {
            clientId: Math.floor(Math.random() * 1000),
            name: `Demo Client ${Math.random().toString(36).substr(2, 5)}`,
            wallet: '0x' + require('crypto').randomBytes(20).toString('hex')
          }
        };
        break;
        
      case 'PASSPORT_CREATED':
        transaction = {
          type,
          data: {
            passportId: Math.floor(Math.random() * 1000),
            nfcUid: 'NFC-' + Math.random().toString(36).substr(2, 8).toUpperCase(),
            brand: ['Hermès', 'Chanel', 'Rolex', 'Patek Philippe'][Math.floor(Math.random() * 4)],
            status: 'VACANT'
          }
        };
        break;
        
      case 'SBT_MINTED':
        transaction = {
          type,
          data: {
            tokenId: Math.floor(Math.random() * 10000),
            passportId: Math.floor(Math.random() * 100),
            owner: '0x' + require('crypto').randomBytes(20).toString('hex'),
            tokenURI: 'ipfs://Qm' + require('crypto').randomBytes(23).toString('hex')
          }
        };
        break;
    }
    
    if (transaction) {
      this.addTransaction(transaction);
    }
  }

  getBlockchainInfo() {
    return {
      height: this.chain.length,
      latestBlock: this.getLatestBlock(),
      pendingTransactions: this.pendingTransactions.length,
      difficulty: this.difficulty,
      isRunning: this.isRunning,
      stats: this.stats,
      networkInfo: {
        name: 'AUCTA Private Network',
        chainId: 1337,
        consensus: 'Proof of Authority (PoA)',
        blockTime: this.miningInterval / 1000 + 's',
        validators: 10
      }
    };
  }

  getBlocks(limit = 10) {
    return this.chain.slice(-limit).reverse();
  }

  getTransactionHistory(limit = 50) {
    const allTransactions = [];
    
    // Récupérer toutes les transactions des blocs
    for (let i = this.chain.length - 1; i >= 0 && allTransactions.length < limit; i--) {
      const block = this.chain[i];
      block.transactions.forEach(tx => {
        if (allTransactions.length < limit) {
          allTransactions.push({
            ...tx,
            blockNumber: block.index,
            blockHash: block.hash
          });
        }
      });
    }
    
    // Ajouter les transactions en attente
    this.pendingTransactions.forEach(tx => {
      allTransactions.unshift({
        ...tx,
        blockNumber: 'pending',
        blockHash: 'pending'
      });
    });
    
    return allTransactions;
  }
}

// Exporter une instance unique
const blockchainSimulator = new AuctaBlockchainSimulator();

module.exports = { blockchainSimulator, AuctaBlockchainSimulator };