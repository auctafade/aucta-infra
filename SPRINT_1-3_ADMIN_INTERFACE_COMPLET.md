# SPRINT 1-3 : INTERFACE ADMIN - RÉCAPITULATIF COMPLET

## Vue d'ensemble du système

L'interface admin (Sprint 1-3) constitue le cœur opérationnel de la plateforme AUCTA. Elle permet aux administrateurs de gérer l'ensemble de l'écosystème d'authentification des produits de luxe, depuis l'enregistrement des clients jusqu'à la gestion des reventes en passant par la création de passeports numériques.

## Architecture générale

### Frontend
- **Base URL**: `/sprint-1/`
- **Pages principales**: 4 pages administratives
- **Framework**: Next.js avec TypeScript
- **Styling**: CSS inline pour un design moderne et minimaliste

### Backend  
- **Serveur**: Node.js avec Express
- **Base de données**: PostgreSQL avec schéma complet
- **Port**: 4000
- **Architecture**: API REST avec endpoints dédiés

## 1. ENREGISTREMENT DES CLIENTS

### Processus complet

#### Frontend: `/sprint-1/register-client/page.tsx`

**Flux utilisateur en 6 étapes:**

1. **Welcome** - Introduction au processus
2. **Search** - Vérification d'existence du client
3. **Identity** - Saisie des informations personnelles
4. **Documents** - Upload des documents KYC
5. **Wallet** - Configuration du portefeuille blockchain
6. **Review** - Validation finale
7. **Success** - Confirmation d'enregistrement

**Formulaire complet:**
```typescript
interface FormData {
  // Identité
  fullName: string;
  dateOfBirth: string;
  placeOfBirth: string;
  citizenship: string;
  secondaryCitizenship?: string;
  
  // Contact
  email: string;
  phone: string;
  address: string;
  
  // Wallet
  walletOption: 'generate' | 'import';
  walletAddress: string;
  
  // Documents
  govId: File;
  proofAddress: File;
  selfie: File;
}
```

#### Backend: API Endpoints

**POST /register-client**
```javascript
// Enregistrement complet du client
{
  name,
  wallet_address,
  kyc_info: {
    email,
    phone,
    address,
    dateOfBirth,
    placeOfBirth,
    citizenship,
    fullName,
    selfie // URL de l'image sauvegardée
  }
}
```

**GET /api/sprint3/client/search**
```javascript
// Recherche de clients existants
// Paramètres: ?q=<terme_recherche>
// Retourne: liste des clients matchants
```

### Tables SQL impliquées

#### Table `clients`
```sql
CREATE TABLE clients (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    wallet_address VARCHAR(255) UNIQUE NOT NULL,
    kyc_info TEXT, -- JSON avec informations KYC
    email VARCHAR(255),
    phone VARCHAR(50),
    street_address TEXT,
    zip_code VARCHAR(20),
    city VARCHAR(100),
    country VARCHAR(100),
    kyc_status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### Table `action_logs`
```sql
CREATE TABLE action_logs (
    id SERIAL PRIMARY KEY,
    client_id INTEGER,
    passport_id INTEGER,
    action VARCHAR(100) NOT NULL,
    details JSONB,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Fonctionnalités avancées

- **Upload d'images**: Conversion base64 → fichiers sauvegardés
- **Validation KYC**: Vérification automatique des documents
- **Génération de wallet**: Création automatique d'adresses blockchain
- **Audit trail**: Logging de toutes les actions dans `action_logs`

## 2. CRÉATION DE PASSEPORTS NUMÉRIQUES

### Processus de création

#### Frontend: `/sprint-1/create-passport/page.tsx`

**Interface de création:**
- Formulaire pour métadonnées produit
- Upload d'images produit
- Génération automatique de NFC UID
- Aperçu en temps réel du passeport

**Structure des métadonnées:**
```typescript
interface PassportMetadata {
  // Produit
  brand: string;
  object_name: string;
  collection_year: string;
  original_price: string;
  
  // Caractéristiques
  main_color: string;
  main_materials: string[];
  dimensions: string;
  weight: string;
  description: string;
  
  // Images
  product_image: string; // URL de l'image
  
  // Traçabilité
  created_by_role: 'admin' | 'manufacturer';
  created_at: string;
}
```

#### Backend: API Endpoints

**POST /create-passport**
```javascript
{
  nfc_uid: string,
  metadata: PassportMetadata,
  metadata_hash: string // Optionnel, généré automatiquement
}
```

### Tables SQL impliquées

#### Table `passports`
```sql
CREATE TABLE passports (
    id SERIAL PRIMARY KEY,
    nfc_uid VARCHAR(255) UNIQUE NOT NULL,
    metadata_hash VARCHAR(255) NOT NULL,
    metadata JSONB NOT NULL,
    status VARCHAR(50) DEFAULT 'VACANT',
    assigned_client_id INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    collection_year VARCHAR(50)
);
```

### Fonctionnalités

- **Hash de métadonnées**: Génération automatique pour l'intégrité
- **Gestion d'images**: Sauvegarde dans `/uploads/`
- **États du passeport**: VACANT → ASSIGNED → MINTED
- **Recherche avancée**: Par NFC UID, marque, année, etc.

## 3. ASSIGNATION DES PASSEPORTS

### Processus d'assignation

#### Frontend: `/sprint-1/assign-passport/page.tsx`

**Interface d'assignation:**
- Recherche de passeports disponibles
- Sélection du client destinataire
- Validation de l'assignation
- Génération de transaction ID

#### Backend: API Endpoints

**POST /assign/:passportId**
```javascript
{
  clientId: number
}
```

**GET /assignment/:transactionId**
```javascript
// Récupération des détails d'assignation
// Utilisé pour la page mint-sbt
```

### Logique métier

1. **Vérification de disponibilité**: Passeport doit être VACANT
2. **Validation du client**: Client doit exister et être vérifié
3. **Transaction atomique**: BEGIN → UPDATE → LOG → COMMIT
4. **Génération de transaction ID**: Pour traçabilité blockchain

```javascript
// Transaction SQL
BEGIN;
UPDATE passports SET assigned_client_id = ?, status = 'ASSIGNED' WHERE id = ?;
INSERT INTO action_logs (passport_id, client_id, action, details) VALUES (?, ?, 'PASSPORT_ASSIGNED', ?);
COMMIT;
```

## 4. CRÉATION DE SBT (SOUL BOUND TOKENS)

### Processus de minting

#### Frontend: `/sprint-1/mint-sbt/page.tsx`

**Interface de minting:**
- Validation des informations passeport/client
- Simulation de blockchain
- Génération de hash SBT
- Enregistrement sur blockchain simulée

#### Backend: API Endpoints

**POST /mint-sbt/:passportId**
```javascript
// Minting automatique basé sur l'assignation
// Pas de paramètres requis
```

### Tables SQL impliquées

#### Table `sbts`
```sql
CREATE TABLE sbts (
    id SERIAL PRIMARY KEY,
    passport_id INTEGER UNIQUE NOT NULL,
    client_id INTEGER NOT NULL,
    sbt_hash VARCHAR(66) NOT NULL,
    blockchain_tx_hash VARCHAR(66) NOT NULL,
    minted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### Table `blockchain_transactions`
```sql
CREATE TABLE blockchain_transactions (
    id SERIAL PRIMARY KEY,
    passport_id INTEGER,
    client_id INTEGER,
    transaction_hash VARCHAR(66) NOT NULL,
    transaction_type VARCHAR(50) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Fonctionnalités blockchain

- **Hash SBT**: Génération cryptographique unique
- **Transaction hash**: Simulation de transaction blockchain
- **Immutabilité**: SBT non transférable (Soul Bound)
- **Traçabilité**: Enregistrement complet dans blockchain_transactions

## 5. GESTION DES REVENTES (SPRINT 3)

### Système de revente complet

#### Backend: APIs de revente

**POST /api/sprint3/resale/initiate**
```javascript
{
  passport_id: number,
  seller_id: number,
  asking_price: number,
  minimum_price: number,
  currency: string,
  marketplace_id: string
}
```

**POST /api/sprint3/resale/:resaleId/assign-buyer**
```javascript
{
  buyer_id: number,
  agreed_price: number
}
```

**POST /api/sprint3/resale/:resaleId/finalize**
```javascript
{
  ownership_transfer: boolean,
  sbt_minted: boolean,
  passport_updated: boolean,
  blockchain_anchored: boolean,
  metadata_archived: boolean
}
```

### Tables SQL de revente

#### Table `resale_events`
```sql
CREATE TABLE resale_events (
    id SERIAL PRIMARY KEY,
    resale_id VARCHAR(255) UNIQUE NOT NULL,
    passport_id INTEGER NOT NULL,
    seller_id INTEGER NOT NULL,
    buyer_id INTEGER,
    asking_price NUMERIC(15,2) NOT NULL,
    minimum_price NUMERIC(15,2),
    currency VARCHAR(10) DEFAULT 'EUR',
    marketplace_id VARCHAR(100),
    status VARCHAR(50) DEFAULT 'ready_for_resale',
    initiated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### Table `resale_configurations`
```sql
CREATE TABLE resale_configurations (
    id SERIAL PRIMARY KEY,
    passport_id INTEGER UNIQUE NOT NULL,
    resale_type VARCHAR(50) NOT NULL,
    royalties_enabled BOOLEAN DEFAULT false,
    cashback_enabled BOOLEAN DEFAULT false,
    brand_participation BOOLEAN DEFAULT false,
    ownership_depth INTEGER DEFAULT 1,
    royalty_tiers JSONB,
    cashback_tiers JSONB
);
```

### Workflow de revente

1. **Initiation**: Propriétaire met en vente
2. **Configuration**: Paramètres de royalties/cashback
3. **Listing**: Mise sur marketplace
4. **Assignment**: Attribution à un acheteur
5. **Finalisation**: Transfert de propriété + nouveau SBT
6. **Archivage**: Sauvegarde des métadonnées

## 6. ÉVALUATION DES PRODUITS

### Système d'évaluation

#### Table `product_valuations`
```sql
CREATE TABLE product_valuations (
    id SERIAL PRIMARY KEY,
    passport_id INTEGER,
    valuation_type VARCHAR(50) NOT NULL, -- 'market', 'insurance', 'auction', 'appraisal'
    valuation_amount NUMERIC(15,2) NOT NULL,
    currency VARCHAR(10) DEFAULT 'EUR',
    valuation_date DATE NOT NULL,
    appraiser_name VARCHAR(255),
    confidence_level VARCHAR(20), -- 'low', 'medium', 'high', 'certified'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### APIs d'évaluation

**POST /api/sprint3/valuation/upsert**
```javascript
{
  passport_id: number,
  valuation_amount: number,
  currency: string,
  appraiser_name: string,
  confidence_level: string,
  valuation_type: string
}
```

## 7. GESTION DES HUBS LOGISTIQUES

### Table `hubs`
```sql
CREATE TABLE hubs (
    id SERIAL PRIMARY KEY,
    code VARCHAR(10) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    location VARCHAR(255),
    timezone VARCHAR(50),
    status VARCHAR(50) DEFAULT 'active',
    roles JSONB DEFAULT '["authenticator"]',
    logo VARCHAR(255),
    address JSONB,
    contact_info JSONB,
    pricing JSONB,
    capacity JSONB,
    operating_hours JSONB,
    special_surcharges JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### APIs de gestion des hubs

**GET /api/hubs** - Liste tous les hubs
**POST /api/hubs** - Création d'un nouveau hub
**PUT /api/hubs/:id** - Mise à jour d'un hub
**DELETE /api/hubs/:id** - Suppression d'un hub

## 8. SYSTÈME DE SÉCURITÉ ET AUDIT

### Logging complet
Toutes les actions sont loggées dans `action_logs`:

```javascript
// Types d'actions trackées
const ACTIONS = [
  'CLIENT_REGISTERED',
  'CLIENT_LOGIN',
  'PASSPORT_CREATED',
  'PASSPORT_ASSIGNED',
  'SBT_MINTED',
  'RESALE_INITIATED',
  'RESALE_FINALIZED',
  'VALUATION_UPDATED',
  'TRANSFER_REQUEST_SUBMITTED'
];
```

### Authentification
- **JWT Tokens**: Génération et validation
- **Middleware d'auth**: Protection des routes sensibles
- **Sessions**: Gestion des sessions utilisateur

## 9. APIS DE RECHERCHE ET FILTRAGE

### Recherche avancée de passeports
**GET /api/sprint3/passport/search**
- Recherche par ID, NFC UID, marque, client
- Filtrage par statut, année de collection
- Tri par pertinence et date

### Recherche de clients
**GET /api/sprint3/client/search**
- Recherche par nom, email, wallet address
- Filtrage par statut KYC
- Information sur le statut du vault

## 10. GESTION DES DOCUMENTS

### Upload et stockage
- **Dossier uploads**: `/uploads/` avec sous-dossiers
- **Types supportés**: Images, PDFs, documents
- **Conversion base64**: Sauvegarde automatique
- **Génération PDF**: Certificats d'authenticité

### Types de documents générés
- **Certificats KYC**: Pour clients vérifiés
- **Passeports produits**: Documents PDF détaillés
- **Certificats d'authenticité**: Preuves blockchain
- **Certificats blockchain**: Métadonnées JSON

## 11. ARCHITECTURE DE DONNÉES

### Relations principales
```
clients (1) ←→ (N) passports
passports (1) ←→ (1) sbts
passports (1) ←→ (N) product_valuations
passports (1) ←→ (1) resale_configurations
clients (1) ←→ (N) resale_events
passports (1) ←→ (N) action_logs
```

### Intégrité des données
- **Contraintes FK**: Relations strictes entre tables
- **Validations**: Checks sur les statuts et types
- **Transactions**: Opérations atomiques critiques
- **Indexes**: Performance sur les recherches fréquentes

## 12. CONFIGURATION ET DÉPLOIEMENT

### Variables d'environnement
```bash
DB_HOST=localhost
DB_PORT=5432
DB_NAME=aucta_db
DB_USER=AUCTA
DB_PASSWORD=AUCTA123
PORT=4000
JWT_SECRET=your_jwt_secret
```

### Structure des fichiers
```
backend/
├── server.js              # Serveur principal
├── database/
│   ├── connection.js       # Connexion PostgreSQL
│   └── schema.sql         # Schéma complet
├── routes/
│   ├── hubs.js           # Gestion des hubs
│   └── contacts.js       # Gestion des contacts
├── uploads/              # Fichiers uploadés
│   ├── documents/        # PDFs générés
│   ├── passports/        # Images passeports
│   └── selfies/         # Photos clients
└── lib/
    └── auth.js          # Authentification

frontend/src/app/sprint-1/
├── register-client/     # Enregistrement clients
├── create-passport/     # Création passeports
├── assign-passport/     # Assignation
└── mint-sbt/           # Création SBT
```

## 13. FONCTIONNALITÉS AVANCÉES

### MoneySBT (Système de cashback)
- **Calcul automatique**: 2% de cashback sur les achats
- **Accumulation**: Balance MoneySBT par client
- **Historique**: Transactions de cashback trackées

### Système de transferts
- **Demandes de transfert**: Table `transfer_requests`
- **Validation administrative**: Workflow d'approbation
- **Types de transfert**: Vente, donation, héritage

### Gestion des proxies
- **Table `proxy_assignments`**: Représentants légaux
- **Rôles**: viewer, legal_proxy, inheritance_heir
- **Validation**: Documents et vérifications requises

## 14. PERFORMANCE ET OPTIMISATION

### Caching
- **Métadonnées fréquentes**: Cache en mémoire
- **Images**: Optimisation et compression
- **Requêtes**: Indexation stratégique

### Monitoring
- **Logs serveur**: Toutes actions trackées
- **Métriques performance**: Temps de réponse API
- **Alertes**: Détection d'anomalies

Cette interface admin constitue le backbone complet de la plateforme AUCTA, permettant une gestion exhaustive de l'écosystème d'authentification des produits de luxe avec une traçabilité blockchain complète.
