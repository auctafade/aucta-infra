# AUCTA Blockchain Infrastructure

**AUCTA** is a secure, closed digital infrastructure for authenticating, tracking, and managing the complete ownership lifecycle of luxury products. It creates an unbreakable link between physical items and their digital identity through NFC technology, private blockchain networks, and provable KYC verification.

---

## 🏗️ System Architecture

AUCTA operates as a multi-layered ecosystem where each component serves a specific purpose in the luxury product authentication pipeline:

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   NFC Device    │───▶│   Frontend      │───▶│   Backend API   │
│   (Physical)    │    │   (Next.js)     │    │   (Node.js)     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                ▲                        │
                                │                        ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   IPFS/Arweave  │◀───│   PostgreSQL    │◀───│  Substrate Node │
│   (Metadata)    │    │   (Index/Cache) │    │  (Blockchain)   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

---

## 🔍 How AUCTA Works

### 1. **Product Registration & NFC Binding**
- Luxury brands register products through the admin interface
- Each product receives a unique NFC chip containing encrypted product ID
- Product metadata (photos, certificates, provenance) stored on IPFS/Arweave
- Blockchain creates immutable **Soulbound Token** representing the product

### 2. **Ownership Verification & KYC**
- New owners scan NFC to claim ownership
- KYC verification required for ownership transfers
- Multi-signature wallets ensure secure, auditable transactions
- PostgreSQL indexes all transactions for fast queries

### 3. **Lifecycle Tracking**
- Every interaction (sale, repair, authentication) recorded on-chain
- Real-time ownership history accessible via API
- Zero-knowledge proofs (ZKP-ready) protect sensitive owner data
- Provenance chain maintains product authenticity

---

## 📁 Project Structure

```
aucta-infra/
├── frontend/                 # Next.js React Application
│   ├── app/                 # App Router pages
│   ├── components/          # Reusable UI components
│   ├── lib/                 # Utilities, API clients
│   └── public/              # Static assets
│
├── backend/                 # Node.js REST API Server
│   ├── controllers/         # Route handlers
│   ├── middleware/          # Auth, validation, logging
│   ├── models/              # Database models (Sequelize/Prisma)
│   ├── routes/              # API endpoint definitions
│   └── services/            # Business logic layer
│
├── substrate-node/          # Custom Blockchain Network
│   ├── pallets/             # Custom blockchain modules
│   ├── runtime/             # Blockchain runtime configuration
│   └── node/                # Network node implementation
│
├── database/                # PostgreSQL Schema & Migrations
│   ├── migrations/          # Database version control
│   ├── seeds/               # Test data
│   └── schema.sql           # Current database structure
│
├── contracts/               # Smart Contracts (if any)
├── docs/                    # Technical documentation
└── scripts/                 # Deployment & utility scripts
```

---

## 🗄️ Database Integration (PostgreSQL)

### Database Schema Overview

The PostgreSQL database serves as the **off-chain indexing layer** that mirrors and extends blockchain data for fast queries, caching, and analytics. It maintains referential integrity while staying synchronized with the Substrate blockchain.

### Core Tables Structure:

#### **Products Table** - Physical Item Registry
```sql
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id UUID NOT NULL REFERENCES brands(id),
    sku VARCHAR(100) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100),
    
    -- NFC Integration
    nfc_chip_id VARCHAR(64) UNIQUE NOT NULL,
    nfc_public_key TEXT NOT NULL,
    
    -- Blockchain References
    soulbound_token_id BIGINT UNIQUE,
    blockchain_tx_hash VARCHAR(66),
    
    -- IPFS Metadata
    ipfs_hash VARCHAR(64),
    metadata_schema_version INTEGER DEFAULT 1,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    registered_on_chain_at TIMESTAMP,
    
    -- Status
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'recalled', 'destroyed'))
);

-- Indexes for fast lookups
CREATE INDEX idx_products_nfc_chip ON products(nfc_chip_id);
CREATE INDEX idx_products_token ON products(soulbound_token_id);
CREATE INDEX idx_products_brand ON products(brand_id);
```

#### **Users Table** - KYC-Verified Accounts
```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    
    -- KYC Information
    kyc_status VARCHAR(20) DEFAULT 'pending' CHECK (kyc_status IN ('pending', 'verified', 'rejected', 'expired')),
    kyc_provider VARCHAR(50),
    kyc_verification_id VARCHAR(255),
    kyc_verified_at TIMESTAMP,
    
    -- Blockchain Wallet
    wallet_address VARCHAR(48) UNIQUE, -- Substrate SS58 address
    wallet_public_key TEXT,
    
    -- Profile
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    phone VARCHAR(20),
    country_code CHAR(2),
    
    -- Security
    two_fa_enabled BOOLEAN DEFAULT FALSE,
    last_login_at TIMESTAMP,
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_users_wallet ON users(wallet_address);
CREATE INDEX idx_users_kyc ON users(kyc_status, kyc_verified_at);
```

#### **Ownership History** - Complete Chain of Custody
```sql
CREATE TABLE ownership_history (
    id SERIAL PRIMARY KEY,
    product_id UUID NOT NULL REFERENCES products(id),
    
    -- Ownership Transfer
    from_user_id UUID REFERENCES users(id), -- NULL for initial registration
    to_user_id UUID NOT NULL REFERENCES users(id),
    
    -- Blockchain References
    blockchain_tx_hash VARCHAR(66) NOT NULL,
    block_number BIGINT NOT NULL,
    extrinsic_index INTEGER,
    
    -- Transfer Details
    transfer_type VARCHAR(20) DEFAULT 'sale' CHECK (transfer_type IN ('initial', 'sale', 'gift', 'inheritance', 'repair_return')),
    sale_price DECIMAL(15,2),
    currency VARCHAR(10),
    
    -- Verification
    nfc_scan_required BOOLEAN DEFAULT TRUE,
    nfc_scan_completed_at TIMESTAMP,
    kyc_verified BOOLEAN DEFAULT FALSE,
    
    -- Metadata
    notes TEXT,
    transfer_initiated_at TIMESTAMP DEFAULT NOW(),
    transfer_completed_at TIMESTAMP,
    
    -- Constraints
    CONSTRAINT ownership_different_users CHECK (from_user_id != to_user_id OR from_user_id IS NULL)
);

-- Indexes for ownership queries
CREATE INDEX idx_ownership_product ON ownership_history(product_id, transfer_completed_at DESC);
CREATE INDEX idx_ownership_user ON ownership_history(to_user_id);
CREATE INDEX idx_ownership_blockchain ON ownership_history(blockchain_tx_hash);
```

#### **NFC Scan Audit Trail**
```sql
CREATE TABLE nfc_scans (
    id SERIAL PRIMARY KEY,
    product_id UUID NOT NULL REFERENCES products(id),
    user_id UUID REFERENCES users(id), -- NULL for anonymous scans
    
    -- Scan Details
    scan_type VARCHAR(20) NOT NULL CHECK (scan_type IN ('ownership_verification', 'transfer_initiation', 'authentication_check', 'repair_log')),
    chip_signature TEXT NOT NULL,
    device_info JSONB,
    location_data JSONB,
    
    -- Results
    verification_successful BOOLEAN NOT NULL,
    failure_reason VARCHAR(255),
    
    -- Security
    ip_address INET,
    user_agent TEXT,
    
    scanned_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_nfc_scans_product ON nfc_scans(product_id, scanned_at DESC);
CREATE INDEX idx_nfc_scans_user ON nfc_scans(user_id);
```

#### **Blockchain Transaction Sync**
```sql
CREATE TABLE blockchain_transactions (
    id SERIAL PRIMARY KEY,
    tx_hash VARCHAR(66) UNIQUE NOT NULL,
    block_number BIGINT NOT NULL,
    block_hash VARCHAR(66) NOT NULL,
    extrinsic_index INTEGER NOT NULL,
    
    -- Transaction Type
    pallet_name VARCHAR(50) NOT NULL, -- e.g., 'productRegistry', 'ownership'
    call_name VARCHAR(50) NOT NULL,   -- e.g., 'registerProduct', 'transferOwnership'
    
    -- Status
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'finalized', 'failed')),
    error_message TEXT,
    
    -- Processed flags
    indexed_in_sql BOOLEAN DEFAULT FALSE,
    events_processed BOOLEAN DEFAULT FALSE,
    
    -- Raw data
    raw_extrinsic JSONB,
    events JSONB,
    
    -- Timestamps
    blockchain_timestamp TIMESTAMP,
    indexed_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_blockchain_tx_hash ON blockchain_transactions(tx_hash);
CREATE INDEX idx_blockchain_block ON blockchain_transactions(block_number, extrinsic_index);
CREATE INDEX idx_blockchain_unprocessed ON blockchain_transactions(indexed_in_sql, events_processed) WHERE NOT indexed_in_sql OR NOT events_processed;
```

### SQL-Blockchain Synchronization

#### **Event Processing Pipeline**
```sql
-- Function to process blockchain events and update local tables
CREATE OR REPLACE FUNCTION process_ownership_transfer_event(
    p_tx_hash VARCHAR(66),
    p_product_token_id BIGINT,
    p_from_address VARCHAR(48),
    p_to_address VARCHAR(48),
    p_block_number BIGINT
) RETURNS VOID AS $$
DECLARE
    v_product_id UUID;
    v_from_user_id UUID;
    v_to_user_id UUID;
BEGIN
    -- Find product by soulbound token ID
    SELECT id INTO v_product_id 
    FROM products 
    WHERE soulbound_token_id = p_product_token_id;
    
    -- Find users by wallet addresses
    SELECT id INTO v_from_user_id FROM users WHERE wallet_address = p_from_address;
    SELECT id INTO v_to_user_id FROM users WHERE wallet_address = p_to_address;
    
    -- Insert ownership transfer record
    INSERT INTO ownership_history (
        product_id, from_user_id, to_user_id,
        blockchain_tx_hash, block_number,
        transfer_type, transfer_completed_at
    ) VALUES (
        v_product_id, v_from_user_id, v_to_user_id,
        p_tx_hash, p_block_number,
        'sale', NOW()
    );
    
    -- Mark blockchain transaction as processed
    UPDATE blockchain_transactions 
    SET indexed_in_sql = TRUE 
    WHERE tx_hash = p_tx_hash;
END;
$$ LANGUAGE plpgsql;
```

#### **Data Consistency Views**
```sql
-- Current ownership view (fastest way to check who owns what)
CREATE VIEW current_ownership AS
SELECT DISTINCT ON (product_id)
    product_id,
    to_user_id as current_owner_id,
    transfer_completed_at as owned_since,
    blockchain_tx_hash
FROM ownership_history
WHERE transfer_completed_at IS NOT NULL
ORDER BY product_id, transfer_completed_at DESC;

-- Product authentication view
CREATE VIEW product_authentication AS
SELECT 
    p.id,
    p.name,
    p.nfc_chip_id,
    co.current_owner_id,
    u.email as owner_email,
    u.kyc_status,
    p.status as product_status,
    COUNT(ns.id) as scan_count,
    MAX(ns.scanned_at) as last_scanned
FROM products p
LEFT JOIN current_ownership co ON p.id = co.product_id
LEFT JOIN users u ON co.current_owner_id = u.id
LEFT JOIN nfc_scans ns ON p.id = ns.product_id AND ns.verification_successful = TRUE
GROUP BY p.id, p.name, p.nfc_chip_id, co.current_owner_id, u.email, u.kyc_status, p.status;
```

### Database-API Integration Patterns

#### **Fast Ownership Lookup**
```javascript
// Backend API: Check ownership without blockchain query
app.get('/api/products/:id/owner', async (req, res) => {
    const ownership = await db.query(`
        SELECT u.email, u.wallet_address, co.owned_since
        FROM current_ownership co
        JOIN users u ON co.current_owner_id = u.id
        WHERE co.product_id = $1
    `, [req.params.id]);
    
    res.json(ownership.rows[0]);
});
```

#### **Blockchain Sync Health Check**
```sql
-- Query to detect sync lag
SELECT 
    bt.block_number as last_synced_block,
    (SELECT MAX(block_number) FROM blockchain_transactions) as highest_block,
    COUNT(*) FILTER (WHERE NOT indexed_in_sql) as unprocessed_count
FROM blockchain_transactions bt
ORDER BY block_number DESC
LIMIT 1;
```

### Performance & Scaling

#### **Partitioning Strategy**
```sql
-- Partition nfc_scans by month for performance
CREATE TABLE nfc_scans_2024_01 PARTITION OF nfc_scans
FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');

-- Automated partition creation
CREATE OR REPLACE FUNCTION create_monthly_partition()
RETURNS TRIGGER AS $$
DECLARE
    partition_date TEXT;
    partition_name TEXT;
BEGIN
    partition_date := to_char(NEW.scanned_at, 'YYYY_MM');
    partition_name := 'nfc_scans_' || partition_date;
    
    -- Create partition if not exists
    EXECUTE format('CREATE TABLE IF NOT EXISTS %I PARTITION OF nfc_scans
                   FOR VALUES FROM (%L) TO (%L)',
                   partition_name,
                   date_trunc('month', NEW.scanned_at),
                   date_trunc('month', NEW.scanned_at) + interval '1 month');
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

The PostgreSQL database serves as a **fast-query index** for blockchain data, enabling:
- **Sub-millisecond ownership lookups** vs seconds on blockchain
- **Complex analytics queries** across ownership history
- **Real-time fraud detection** through pattern analysis
- **Backup verification** against blockchain state
- **Efficient pagination** for mobile apps
- **Full-text search** across product metadata

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- PostgreSQL 14+
- Rust (for Substrate node)
- Docker (recommended)

### Quick Setup
```bash
# 1. Clone and install dependencies
git clone https://github.com/your-org/aucta-infra.git
cd aucta-infra
npm install

# 2. Setup environment
cp .env.local.example .env.local
# Fill in database credentials, API keys, blockchain endpoints

# 3. Database setup
cd database
psql -U postgres -f schema.sql
npm run migrate

# 4. Start development services
npm run dev:frontend    # http://localhost:3000
npm run dev:backend     # http://localhost:8000
npm run dev:substrate   # Blockchain node on localhost:9944
```

---

## 🔐 Security Architecture

### Authentication Flow:
1. **Users**: JWT + 2FA for web access
2. **NFC Devices**: Encrypted chip signatures
3. **API**: Rate limiting, input validation, audit logging
4. **Blockchain**: Multi-sig wallets, consensus validation

### Data Protection:
- **On-chain**: Only product IDs and ownership records
- **IPFS**: Encrypted metadata with access control
- **SQL**: Indexed references, no sensitive data
- **ZKP Ready**: Future zero-knowledge proof integration

---

## 🛠️ Development Workflow

### Branch Strategy:
```bash
main                    # Production-ready code
├── develop            # Integration branch
├── feature/nfc-auth   # Feature development
├── feature/kyc-flow   # Feature development
└── hotfix/security    # Critical fixes
```

### Testing:
- **Unit Tests**: Jest for backend logic
- **Integration**: API endpoint testing
- **E2E**: Playwright for full user flows
- **Blockchain**: Substrate test runtime

### Deployment:
- **Frontend**: Vercel/Netlify
- **Backend**: Docker containers on AWS/GCP
- **Database**: Managed PostgreSQL (RDS/CloudSQL)
- **Blockchain**: Private validator network

---

## 📚 API Reference

### Core Endpoints:
- `GET /api/products/:id` - Product details and ownership
- `POST /api/auth/nfc-scan` - NFC authentication
- `POST /api/ownership/transfer` - Initiate ownership change
- `GET /api/history/:productId` - Complete provenance chain
- `POST /api/kyc/verify` - User verification flow

### Blockchain Integration:
- All ownership changes trigger Substrate extrinsics
- Events indexed in PostgreSQL for fast queries
- WebSocket subscriptions for real-time updates

---

## 🤝 Contributing

1. **Security First**: All PRs require security review
2. **Never Commit Secrets**: Use `.env.local` for credentials
3. **Test Coverage**: Minimum 80% for new features
4. **Documentation**: Update README for architectural changes

---

## 📖 Additional Resources

- **[API Documentation](./docs/api.md)** - Complete endpoint reference
- **[Blockchain Specification](./docs/blockchain.md)** - Substrate pallet details
- **[NFC Integration Guide](./docs/nfc.md)** - Hardware implementation
- **[Security Audit](./docs/security.md)** - Threat model and mitigations

---

**Built with security, transparency, and luxury product authentication in mind.**

---

## 🎨 Frontend Architecture (Next.js)

### Application Structure

The AUCTA frontend is built with **Next.js 14** using the App Router, providing a modern, responsive interface for luxury product authentication and ownership management.

```
frontend/
├── app/                     # App Router (Next.js 13+)
│   ├── (auth)/             # Authentication group
│   │   ├── login/          # User login page
│   │   ├── register/       # User registration
│   │   └── kyc/            # KYC verification flow
│   ├── dashboard/          # User dashboard
│   │   ├── products/       # Owned products list
│   │   ├── transfers/      # Transfer history
│   │   └── settings/       # Profile settings
│   ├── scan/               # NFC scanning interface
│   ├── admin/              # Brand admin panel
│   │   ├── products/       # Product registration
│   │   ├── users/          # User management
│   │   └── analytics/      # Ownership analytics
│   ├── api/                # API routes (Next.js API)
│   │   ├── auth/           # Authentication endpoints
│   │   ├── nfc/            # NFC verification
│   │   └── webhook/        # Blockchain event handlers
│   ├── globals.css         # Global styles
│   ├── layout.tsx          # Root layout
│   └── page.tsx            # Homepage
├── components/             # Reusable UI Components
│   ├── ui/                 # Base UI components
│   │   ├── Button.tsx      # Custom button component
│   │   ├── Modal.tsx       # Modal dialogs
│   │   ├── QRScanner.tsx   # NFC/QR code scanner
│   │   └── LoadingSpinner.tsx
│   ├── auth/               # Authentication components
│   │   ├── LoginForm.tsx   # Login form with 2FA
│   │   ├── KYCWizard.tsx   # Multi-step KYC process
│   │   └── WalletConnect.tsx
│   ├── product/            # Product-related components
│   │   ├── ProductCard.tsx # Product display card
│   │   ├── OwnershipHistory.tsx # Transfer timeline
│   │   ├── NFCScanner.tsx  # NFC scanning interface
│   │   └── TransferModal.tsx
│   └── dashboard/          # Dashboard components
│       ├── StatCards.tsx   # Metrics overview
│       ├── RecentActivity.tsx
│       └── OwnershipChart.tsx
├── lib/                    # Utilities & Services
│   ├── auth.ts            # Authentication utilities
│   ├── api-client.ts      # Backend API client
│   ├── blockchain.ts      # Substrate API integration
│   ├── nfc.ts             # NFC communication
│   ├── utils.ts           # Helper functions
│   └── validations.ts     # Form validation schemas
├── hooks/                  # Custom React hooks
│   ├── useAuth.ts         # Authentication state
│   ├── useNFC.ts          # NFC scanning hook
│   ├── useBlockchain.ts   # Blockchain state management
│   └── useLocalStorage.ts # Local storage management
├── store/                  # State Management (Zustand)
│   ├── authStore.ts       # User authentication state
│   ├── productStore.ts    # Product data cache
│   └── scanStore.ts       # NFC scan results
├── types/                  # TypeScript definitions
│   ├── api.ts             # API response types
│   ├── blockchain.ts      # Blockchain data types
│   ├── product.ts         # Product & ownership types
│   └── user.ts            # User & KYC types
└── public/                 # Static assets
    ├── icons/             # Custom icons
    ├── images/            # Product images
    └── nfc-patterns/      # NFC chip patterns
```

### Key Frontend Features

#### **NFC Integration**
```typescript
// lib/nfc.ts - NFC Communication Layer
export class NFCManager {
  async scanProduct(): Promise<ProductScanResult> {
    // Initialize NFC reader
    const nfc = new NDEFReader();
    
    // Listen for NFC tags
    const scan = await nfc.scan();
    
    // Decrypt chip signature
    const signature = await this.verifyChipSignature(scan.data);
    
    // Verify against backend
    const verification = await apiClient.post('/api/nfc/verify', {
      chipId: scan.chipId,
      signature: signature,
      timestamp: Date.now()
    });
    
    return {
      productId: verification.productId,
      isAuthentic: verification.valid,
      ownershipStatus: verification.ownership
    };
  }
}
```

#### **Real-time Blockchain Updates**
```typescript
// hooks/useBlockchain.ts - Blockchain State Management
export function useBlockchain() {
  const [events, setEvents] = useState<BlockchainEvent[]>([]);
  
  useEffect(() => {
    // WebSocket connection to Substrate node
    const ws = new WebSocket('ws://localhost:9944');
    
    // Subscribe to ownership transfer events
    ws.send(JSON.stringify({
      method: 'state_subscribeStorage',
      params: [['ProductOwnership']]
    }));
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.params?.result) {
        setEvents(prev => [...prev, data.params.result]);
      }
    };
    
    return () => ws.close();
  }, []);
  
  return { events };
}
```

#### **Authentication Flow**
```typescript
// components/auth/LoginForm.tsx - Multi-factor Authentication
export function LoginForm() {
  const [step, setStep] = useState<'email' | '2fa' | 'wallet'>('email');
  const { login } = useAuth();
  
  const handleEmailLogin = async (email: string, password: string) => {
    const response = await apiClient.post('/api/auth/login', {
      email, password
    });
    
    if (response.requires2FA) {
      setStep('2fa');
    } else if (response.requiresWallet) {
      setStep('wallet');
    } else {
      await login(response.token);
    }
  };
  
  const handle2FA = async (code: string) => {
    // TOTP verification
    const response = await apiClient.post('/api/auth/verify-2fa', {
      code, sessionId: tempSession
    });
    
    if (response.success) {
      setStep('wallet');
    }
  };
  
  const handleWalletConnect = async () => {
    // Connect Substrate wallet (Polkadot.js extension)
    const { web3Accounts, web3Enable } = await import('@polkadot/extension-dapp');
    
    await web3Enable('AUCTA');
    const accounts = await web3Accounts();
    
    // Link wallet to account
    await apiClient.post('/api/auth/link-wallet', {
      address: accounts[0].address,
      sessionId: tempSession
    });
    
    await login(finalToken);
  };
  
  // Render based on current step...
}
```

---

## ⚙️ Backend Architecture (Node.js)

### Service Layer Design

The AUCTA backend follows a **microservices-inspired architecture** with clear separation of concerns, enabling scalability and maintainability.

```
backend/
├── src/
│   ├── controllers/         # HTTP Request Handlers
│   │   ├── AuthController.js      # Authentication endpoints
│   │   ├── ProductController.js   # Product management
│   │   ├── OwnershipController.js # Ownership transfers
│   │   ├── NFCController.js       # NFC verification
│   │   ├── KYCController.js       # Identity verification
│   │   └── AnalyticsController.js # Reporting & metrics
│   ├── services/            # Business Logic Layer
│   │   ├── AuthService.js         # JWT, 2FA, session management
│   │   ├── ProductService.js      # Product lifecycle management
│   │   ├── BlockchainService.js   # Substrate integration
│   │   ├── IPFSService.js         # Metadata storage
│   │   ├── KYCService.js          # Identity verification
│   │   ├── NFCService.js          # Chip authentication
│   │   └── NotificationService.js # Email, SMS, push notifications
│   ├── middleware/          # Request Processing
│   │   ├── auth.js               # JWT validation
│   │   ├── rateLimiter.js        # API rate limiting
│   │   ├── validation.js         # Input validation
│   │   ├── audit.js              # Security logging
│   │   └── cors.js               # Cross-origin requests
│   ├── models/              # Database Models
│   │   ├── User.js               # User accounts & KYC
│   │   ├── Product.js            # Product registry
│   │   ├── Ownership.js          # Transfer history
│   │   ├── NFCScan.js            # Scan audit trail
│   │   └── BlockchainTx.js       # Transaction sync
│   ├── routes/              # API Endpoint Definitions
│   │   ├── auth.js               # /api/auth/*
│   │   ├── products.js           # /api/products/*
│   │   ├── ownership.js          # /api/ownership/*
│   │   ├── nfc.js                # /api/nfc/*
│   │   └── admin.js              # /api/admin/*
│   ├── utils/               # Helper Functions
│   │   ├── crypto.js             # Encryption utilities
│   │   ├── validators.js         # Data validation
│   │   ├── logger.js             # Structured logging
│   │   └── errors.js             # Error handling
│   ├── config/              # Configuration
│   │   ├── database.js           # PostgreSQL connection
│   │   ├── blockchain.js         # Substrate API setup
│   │   ├── ipfs.js               # IPFS node configuration
│   │   └── security.js           # Security policies
│   └── jobs/                # Background Tasks
│       ├── blockchainSync.js     # Sync blockchain events
│       ├── kycVerification.js    # Process KYC submissions
│       ├── nfcHealthCheck.js     # Monitor NFC chip status
│       └── analyticsProcessor.js # Generate reports
├── tests/                   # Test Suite
│   ├── unit/               # Unit tests
│   ├── integration/        # API integration tests
│   └── e2e/                # End-to-end tests
├── docs/                   # API Documentation
│   ├── swagger.yaml        # OpenAPI specification
│   └── postman/            # Postman collections
└── scripts/                # Utility Scripts
    ├── migrate-db.js       # Database migrations
    ├── seed-data.js        # Test data generation
    └── deploy.js           # Deployment automation
```

### Core Backend Services

#### **Blockchain Integration Service**
```javascript
// services/BlockchainService.js - Substrate Chain Integration
class BlockchainService {
  constructor() {
    this.api = null;
    this.keyring = new Keyring({ type: 'sr25519' });
  }
  
  async initialize() {
    // Connect to Substrate node
    const provider = new WsProvider('ws://localhost:9944');
    this.api = await ApiPromise.create({ provider });
    
    // Subscribe to events
    this.api.query.system.events((events) => {
      events.forEach(this.processEvent.bind(this));
    });
  }
  
  async registerProduct(productData, brandWallet) {
    // Create soulbound token on blockchain
    const extrinsic = this.api.tx.productRegistry.registerProduct(
      productData.nfcChipId,
      productData.ipfsHash,
      productData.brandId
    );
    
    // Sign and submit transaction
    const hash = await extrinsic.signAndSend(brandWallet);
    
    // Update PostgreSQL with transaction reference
    await ProductService.updateBlockchainReference(
      productData.id, 
      hash.toString()
    );
    
    return hash;
  }
  
  async transferOwnership(productId, fromWallet, toWallet) {
    // Multi-signature transfer for high-value items
    const extrinsic = this.api.tx.ownership.transferWithMultisig(
      productId,
      toWallet.address,
      { threshold: 2, otherSignatories: [escrowWallet.address] }
    );
    
    return await extrinsic.signAndSend(fromWallet);
  }
  
  async processEvent(event) {
    const { section, method, data } = event.event;
    
    if (section === 'ownership' && method === 'TransferCompleted') {
      // Sync ownership change to PostgreSQL
      await this.syncOwnershipChange(data);
    }
    
    if (section === 'productRegistry' && method === 'ProductRegistered') {
      // Update product status in database
      await this.syncProductRegistration(data);
    }
  }
}
```

#### **NFC Authentication Service**
```javascript
// services/NFCService.js - NFC Chip Verification
class NFCService {
  async verifyChipSignature(chipId, signature, timestamp) {
    // Get chip's public key from database
    const product = await Product.findOne({
      where: { nfc_chip_id: chipId }
    });
    
    if (!product) {
      throw new Error('Product not found');
    }
    
    // Verify cryptographic signature
    const message = `${chipId}:${timestamp}`;
    const isValid = crypto.verify(
      'sha256',
      Buffer.from(message),
      product.nfc_public_key,
      signature
    );
    
    if (!isValid) {
      // Log suspicious activity
      await this.logSuspiciousActivity(chipId, signature);
      return { valid: false, reason: 'Invalid signature' };
    }
    
    // Check replay attack protection (timestamp)
    const lastScan = await NFCScan.findOne({
      where: { product_id: product.id },
      order: [['scanned_at', 'DESC']]
    });
    
    if (lastScan && (timestamp <= lastScan.timestamp)) {
      return { valid: false, reason: 'Replay attack detected' };
    }
    
    // Log successful scan
    await NFCScan.create({
      product_id: product.id,
      chip_signature: signature,
      verification_successful: true,
      scanned_at: new Date(timestamp)
    });
    
    return {
      valid: true,
      product: product,
      currentOwner: await this.getCurrentOwner(product.id)
    };
  }
  
  async getCurrentOwner(productId) {
    const ownership = await db.query(`
      SELECT u.email, u.wallet_address, co.owned_since
      FROM current_ownership co
      JOIN users u ON co.current_owner_id = u.id
      WHERE co.product_id = $1
    `, [productId]);
    
    return ownership.rows[0];
  }
}
```

#### **KYC Verification Service**
```javascript
// services/KYCService.js - Identity Verification
class KYCService {
  async initiateVerification(userId, documents) {
    // Integrate with KYC provider (e.g., Jumio, Onfido)
    const verification = await this.kycProvider.createVerification({
      userId: userId,
      documents: documents,
      requiredChecks: ['identity', 'address', 'sanctions']
    });
    
    // Store verification reference
    await User.update({
      kyc_verification_id: verification.id,
      kyc_status: 'pending'
    }, {
      where: { id: userId }
    });
    
    return verification;
  }
  
  async processWebhook(payload) {
    const { verificationId, status, result } = payload;
    
    // Find user by verification ID
    const user = await User.findOne({
      where: { kyc_verification_id: verificationId }
    });
    
    if (status === 'completed') {
      if (result.identity.valid && result.sanctions.clear) {
        // Approve KYC
        await user.update({
          kyc_status: 'verified',
          kyc_verified_at: new Date()
        });
        
        // Enable blockchain features
        await this.enableBlockchainFeatures(user.id);
        
        // Send approval notification
        await NotificationService.sendKYCApproval(user.email);
      } else {
        // Reject KYC
        await user.update({
          kyc_status: 'rejected'
        });
        
        await NotificationService.sendKYCRejection(user.email, result.reasons);
      }
    }
  }
}
```

---

## 🔗 Critical System Connections

### Frontend ↔ Backend Communication

#### **API Client Architecture**
```typescript
// frontend/lib/api-client.ts - Centralized API Communication
class APIClient {
  private baseURL = process.env.NEXT_PUBLIC_API_URL;
  private token: string | null = null;
  
  constructor() {
    // Initialize with stored auth token
    this.token = localStorage.getItem('auth_token');
  }
  
  async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;
    
    const config: RequestInit = {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(this.token && { Authorization: `Bearer ${this.token}` }),
        ...options.headers,
      },
    };
    
    const response = await fetch(url, config);
    
    if (response.status === 401) {
      // Token expired, redirect to login
      this.token = null;
      localStorage.removeItem('auth_token');
      window.location.href = '/login';
      throw new Error('Authentication required');
    }
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'API request failed');
    }
    
    return response.json();
  }
  
  // Product-specific methods
  async scanNFC(chipId: string, signature: string): Promise<ScanResult> {
    return this.request('/api/nfc/verify', {
      method: 'POST',
      body: JSON.stringify({ chipId, signature, timestamp: Date.now() })
    });
  }
  
  async transferOwnership(productId: string, toWallet: string): Promise<TransferResult> {
    return this.request(`/api/ownership/transfer`, {
      method: 'POST',
      body: JSON.stringify({ productId, toWallet })
    });
  }
  
  async getProductHistory(productId: string): Promise<OwnershipHistory[]> {
    return this.request(`/api/products/${productId}/history`);
  }
}
```

### Backend ↔ Blockchain Synchronization

#### **Event Processing Pipeline**
```javascript
// backend/jobs/blockchainSync.js - Real-time Blockchain Event Processing
class BlockchainSyncJob {
  async start() {
    // Subscribe to all blockchain events
    const api = await BlockchainService.getAPI();
    
    api.query.system.events((events) => {
      events.forEach(async (record) => {
        const { event } = record;
        
        try {
          await this.processBlockchainEvent(event, record);
        } catch (error) {
          logger.error('Failed to process blockchain event', {
            event: event.toHuman(),
            error: error.message
          });
        }
      });
    });
  }
  
  async processBlockchainEvent(event, record) {
    const { section, method, data } = event;
    const blockHash = record.phase.asApplyExtrinsic;
    
    // Store raw event in database
    await BlockchainTransaction.create({
      tx_hash: record.hash?.toString(),
      block_number: record.blockNumber,
      pallet_name: section,
      call_name: method,
      raw_data: event.toJSON(),
      indexed_at: new Date()
    });
    
    // Process specific event types
    switch (`${section}.${method}`) {
      case 'productRegistry.ProductRegistered':
        await this.handleProductRegistration(data);
        break;
        
      case 'ownership.OwnershipTransferred':
        await this.handleOwnershipTransfer(data);
        break;
        
      case 'ownership.TransferInitiated':
        await this.handleTransferInitiation(data);
        break;
        
      default:
        logger.debug('Unhandled blockchain event', { section, method });
    }
  }
  
  async handleOwnershipTransfer(data) {
    const [tokenId, fromAddress, toAddress] = data;
    
    // Find product and users
    const product = await Product.findOne({
      where: { soulbound_token_id: tokenId.toString() }
    });
    
    const fromUser = fromAddress ? await User.findOne({
      where: { wallet_address: fromAddress.toString() }
    }) : null;
    
    const toUser = await User.findOne({
      where: { wallet_address: toAddress.toString() }
    });
    
    // Create ownership record
    await OwnershipHistory.create({
      product_id: product.id,
      from_user_id: fromUser?.id,
      to_user_id: toUser.id,
      blockchain_tx_hash: record.hash.toString(),
      transfer_type: fromUser ? 'sale' : 'initial',
      transfer_completed_at: new Date()
    });
    
    // Notify users
    if (toUser) {
      await NotificationService.sendOwnershipConfirmation(
        toUser.email, 
        product.name
      );
    }
    
    // Update frontend via WebSocket
    WebSocketService.broadcast('ownership_transferred', {
      productId: product.id,
      newOwner: toUser.email,
      timestamp: new Date()
    });
  }
}
```

### Database ↔ Blockchain Consistency

#### **Two-Way Sync Verification**
```javascript
// backend/services/ConsistencyService.js - Data Integrity Verification
class ConsistencyService {
  async verifyDataConsistency() {
    const inconsistencies = [];
    
    // Check ownership consistency
    const sqlOwnerships = await db.query(`
      SELECT product_id, current_owner_id, blockchain_tx_hash
      FROM current_ownership
    `);
    
    for (const sqlOwnership of sqlOwnerships.rows) {
      const product = await Product.findByPk(sqlOwnership.product_id);
      
      // Query blockchain for current owner
      const blockchainOwner = await BlockchainService.getTokenOwner(
        product.soulbound_token_id
      );
      
      const sqlUser = await User.findByPk(sqlOwnership.current_owner_id);
      
      if (blockchainOwner !== sqlUser.wallet_address) {
        inconsistencies.push({
          type: 'ownership_mismatch',
          productId: product.id,
          sqlOwner: sqlUser.wallet_address,
          blockchainOwner: blockchainOwner,
          lastTxHash: sqlOwnership.blockchain_tx_hash
        });
      }
    }
    
    // Check for missing blockchain events
    const latestBlock = await BlockchainService.getLatestBlock();
    const lastSyncedBlock = await BlockchainTransaction.max('block_number');
    
    if (latestBlock - lastSyncedBlock > 10) {
      inconsistencies.push({
        type: 'sync_lag',
        blockchainBlock: latestBlock,
        syncedBlock: lastSyncedBlock,
        lag: latestBlock - lastSyncedBlock
      });
    }
    
    return inconsistencies;
  }
  
  async reconcileInconsistency(inconsistency) {
    switch (inconsistency.type) {
      case 'ownership_mismatch':
        // Re-sync ownership from blockchain
        await this.resyncOwnership(inconsistency.productId);
        break;
        
      case 'sync_lag':
        // Force sync missing blocks
        await this.syncMissingBlocks(inconsistency.syncedBlock, inconsistency.blockchainBlock);
        break;
    }
  }
}
```

This architecture ensures **reliable, secure, and performant** operation of the AUCTA luxury product authentication system, with robust error handling and data consistency verification between all system components.