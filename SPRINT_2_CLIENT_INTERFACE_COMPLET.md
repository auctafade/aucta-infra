# SPRINT 2 : INTERFACE CLIENT - RÉCAPITULATIF COMPLET

## Vue d'ensemble du système

L'interface client (Sprint 2) constitue le dashboard personnel des propriétaires de produits de luxe authentifiés. Elle leur permet de gérer leur "vault" numérique, accéder à leurs documents, effectuer des transferts, et interagir avec l'écosystème AUCTA de manière sécurisée et intuitive.

## Architecture générale

### Frontend
- **Base URL**: `/sprint-2/`
- **Pages principales**: 16 composants client
- **Framework**: Next.js avec TypeScript
- **Layout**: `ClientDashboardLayout` avec sidebar navigable
- **Authentification**: JWT tokens avec protection de routes

### Backend Connection
- **APIs dédiées**: Endpoints spécifiques clients
- **Authentification requise**: Middleware `requireAuth`
- **Isolation des données**: Accès limité aux données du client connecté

## 1. AUTHENTIFICATION CLIENT

### Processus de connexion

#### Frontend: `/sprint-2/login-client/page.tsx`

**Interface de connexion moderne:**
- **Design**: Authentification biométrique simulée avec UI élégante
- **Méthodes**: Email + authentification biométrique
- **Animations**: Effets visuels lors du scan biométrique
- **UX**: Interface intuitive avec feedback visuel en temps réel

**Flux d'authentification:**
```typescript
interface LoginFlow {
  email: string;           // Email de connexion
  biometricScan: boolean;  // Simulation de scan biométrique
  mouseTracking: boolean;  // Suivi de souris pour UX
  loadingStates: string;   // États de chargement visuels
}
```

#### Backend: APIs d'authentification

**POST /client/biometric-login-email**
```javascript
{
  email: string  // Email du client
}
// Retourne: token JWT + informations client
```

**POST /client/biometric-login**
```javascript
{
  biometricId: string  // ID biométrique (simulé)
}
// Retourne: token + client data
```

### Tables SQL impliquées

#### Table `client_sessions`
```sql
CREATE TABLE client_sessions (
    id SERIAL PRIMARY KEY,
    client_id INTEGER,
    session_token VARCHAR(500) NOT NULL,
    device_info JSONB,
    ip_address INET,
    location_info JSONB,
    last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    is_active BOOLEAN DEFAULT true
);
```

### Fonctionnalités de sécurité

- **JWT Tokens**: Durée de vie configurable
- **Device tracking**: Enregistrement des appareils
- **Location tracking**: Géolocalisation des connexions
- **Session management**: Gestion des sessions multiples

## 2. VAULT CLIENT (DASHBOARD PRINCIPAL)

### Interface principale

#### Frontend: `/sprint-2/vault-client/page.tsx`

**Dashboard complet:**
- **Vue d'ensemble**: Statistiques du portefeuille
- **Grid produits**: Affichage visuel des items authentifiés
- **Filtres**: Recherche et tri des produits
- **Actions rapides**: Transfert, QR, documents

**Structure des données:**
```typescript
interface VaultData {
  client: ClientInfo;
  products: Product[];
  summary: {
    total_products: number;
    total_value: number;
    minted_products: number;
    recent_activity: number;
  };
  moneySBT: {
    balance: number;
    transactions: Transaction[];
  };
}
```

#### Backend: API du vault

**GET /client/vault-protected/:clientId**
```javascript
// Headers requis: Authorization: Bearer <token>
// Retourne: Liste complète des produits du client
```

### Fonctionnalités du vault

1. **Affichage produits**: Grid responsive avec images
2. **Valeur totale**: Calcul automatique du portefeuille
3. **Statuts produits**: ASSIGNED, MINTED, READY_FOR_RESALE
4. **Recherche**: Filtrage par marque, nom, année
5. **Actions**: Transfert, génération QR, vue détaillée

## 3. PROFIL CLIENT

### Gestion du profil

#### Frontend: `/sprint-2/profile/page.tsx`

**Interface de profil:**
- **Informations KYC**: Affichage read-only des données vérifiées
- **Contact**: Modification des informations de contact
- **Préférences**: Langue, devise, notifications
- **Demandes de modification**: Système de demande pour les données KYC

**Formulaire de modification:**
```typescript
interface ProfileUpdate {
  email: string;
  phone: string;
  preferred_contact: 'email' | 'phone';
  street_address: string;
  city: string;
  country: string;
  language: string;
  currency: string;
  enable_notifications: boolean;
}
```

#### Backend: APIs de profil

**GET /client/:clientId/profile**
```javascript
// Retourne: Profil complet + statistiques
```

**PUT /client/:clientId/profile**
```javascript
{
  email, phone, preferred_contact,
  street_address, city, country,
  language, currency, enable_notifications
}
```

**POST /client/:clientId/kyc-change-request**
```javascript
{
  description: string,
  fields_to_change: string[]
}
```

### Fonctionnalités avancées

- **Demandes de modification KYC**: Workflow d'approbation
- **Historique des modifications**: Audit trail complet
- **Préférences multilingues**: Support international
- **Notifications configurables**: Contrôle granulaire

## 4. GESTION DES DOCUMENTS

### Vault de documents

#### Frontend: `/sprint-2/documents/page.tsx`

**Interface de documents:**
- **Catégories**: Identity, Products, Legal, Blockchain
- **Génération automatique**: Documents basés sur les données client
- **Export**: PDF, ZIP, CSV
- **Téléchargement**: Accès sécurisé aux documents

**Structure des documents:**
```typescript
interface DocumentVault {
  identity: Document[];     // Certificats KYC, identité
  products: ProductDoc[];   // Passeports, authenticité par produit
  legal: Document[];        // Contrats, proxies, légal
  blockchain: Document[];   // Certificats blockchain, SBT
}

interface Document {
  id: string;
  name: string;
  type: string;
  category: string;
  path: string;
  size: string;
  date: string;
  status: 'verified' | 'pending' | 'active';
  format: 'PDF' | 'JSON' | 'JPEG';
}
```

#### Backend: APIs de documents

**GET /client/:clientId/documents**
```javascript
// Génère et retourne tous les documents du client
// Inclut: KYC, passeports produits, certificats authenticité
```

### Génération automatique de documents

1. **Certificats KYC**: Basés sur les informations vérifiées
2. **Passeports produits**: PDF détaillé pour chaque produit
3. **Certificats d'authenticité**: Preuves blockchain
4. **Documents blockchain**: Métadonnées JSON et certificats SBT

### Export et téléchargement

- **Export PDF**: Compilation de tous les documents
- **Export ZIP**: Archive complète du vault
- **Export CSV**: Données structurées pour audit
- **Téléchargement individuel**: Accès sécurisé par document

## 5. WALLET ET BLOCKCHAIN

### Interface wallet

#### Frontend: `/sprint-2/wallet/page.tsx`

**Dashboard wallet:**
- **Balance**: Tokens et SBT détenus
- **Historique**: Transactions blockchain
- **SBT Management**: Gestion des Soul Bound Tokens
- **Connexion**: Intégration avec wallets externes

**Données wallet:**
```typescript
interface WalletData {
  address: string;
  balance: {
    native: number;
    tokens: Token[];
    sbt: SBT[];
  };
  transactions: Transaction[];
  soulboundTokens: SBT[];
}
```

#### Backend: APIs wallet

**GET /client/:clientId/wallet-export**
```javascript
// Export complet des données wallet
// Inclut: SBT, transactions, MoneySBT
```

### Fonctionnalités blockchain

1. **SBT Tracking**: Suivi des Soul Bound Tokens
2. **Transaction History**: Historique complet blockchain
3. **MoneySBT**: Système de cashback intégré
4. **Wallet Connection**: Intégration MetaMask/WalletConnect

## 6. SÉCURITÉ ET PARAMÈTRES

### Interface sécurité

#### Frontend: `/sprint-2/security-settings/page.tsx`

**Paramètres de sécurité:**
- **2FA**: Configuration authentification double facteur
- **Sessions**: Gestion des sessions actives
- **Historique**: Logs de connexion
- **Alertes**: Configuration des notifications sécurité

#### Backend: APIs sécurité

**GET /client/:clientId/security-settings**
```javascript
// Retourne: Paramètres sécurité + historique sessions
```

**POST /client/:clientId/emergency-lockdown**
```javascript
{
  reason: string,
  product_ids: number[],
  biometric_confirmed: boolean
}
```

### Fonctionnalités de sécurité

- **Emergency Lockdown**: Verrouillage d'urgence des produits
- **Session Management**: Contrôle des sessions multiples
- **Location Tracking**: Géolocalisation des accès
- **Audit Trail**: Historique complet des actions

## 7. GESTION DES TRANSFERTS

### Interface de transfert

#### Frontend: `/sprint-2/transfer-request/page.tsx`

**Système de transfert:**
- **Sélection produit**: Choix des items à transférer
- **Destinataire**: Configuration du nouveau propriétaire
- **Raison**: Documentation du transfert
- **Validation**: Processus d'approbation

#### Backend: APIs de transfert

**POST /client/:clientId/transfer-request**
```javascript
{
  product_id: number,
  reason: string,
  is_resale: boolean,
  recipient_wallet_address?: string,
  recipient_first_name?: string,
  recipient_last_name?: string,
  recipient_email?: string
}
```

### Table `transfer_requests`
```sql
CREATE TABLE transfer_requests (
    id SERIAL PRIMARY KEY,
    client_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    reason TEXT NOT NULL,
    is_resale BOOLEAN DEFAULT false,
    recipient_wallet_address VARCHAR(255),
    recipient_first_name VARCHAR(255),
    recipient_last_name VARCHAR(255),
    recipient_email VARCHAR(255),
    status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## 8. SYSTÈME DE MESSAGERIE

### Interface messages

#### Frontend: `/sprint-2/messages/page.tsx`

**Système de messagerie:**
- **Conversations**: Threads avec support AUCTA
- **Notifications**: Alertes en temps réel
- **Pièces jointes**: Support de documents
- **Catégories**: Organisation par type de message

#### Backend: APIs de messagerie

**GET /client/:clientId/messages**
```javascript
// Liste des messages du client
```

**POST /client/:clientId/messages**
```javascript
{
  subject: string,
  content: string,
  message_type: string,
  passport_id?: number
}
```

### Table `messages`
```sql
CREATE TABLE messages (
    id SERIAL PRIMARY KEY,
    client_id INTEGER NOT NULL,
    sender_type VARCHAR(50) NOT NULL,
    subject VARCHAR(255),
    content TEXT NOT NULL,
    message_type VARCHAR(50) DEFAULT 'general',
    status VARCHAR(50) DEFAULT 'active',
    is_read BOOLEAN DEFAULT false,
    attachments JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## 9. ACCÈS QR ET PARTAGE

### Génération QR

#### Frontend: `/sprint-2/qr-access/page.tsx`

**Système QR:**
- **Génération**: QR codes temporaires pour produits
- **Configuration**: Durée, permissions, destinataire
- **Historique**: Logs d'accès QR
- **Révocation**: Annulation des accès actifs

#### Backend: APIs QR

**POST /api/sprint3/qr/generate**
```javascript
{
  product_id: number,
  expiry_hours: number,
  include_metadata: boolean
}
```

### Table `qr_access_tokens`
```sql
CREATE TABLE qr_access_tokens (
    id SERIAL PRIMARY KEY,
    client_id INTEGER,
    passport_id INTEGER,
    token VARCHAR(255) NOT NULL,
    access_reason VARCHAR(50) NOT NULL,
    validity_duration VARCHAR(50) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## 10. HISTORIQUE ET ACTIVITÉ

### Interface activité

#### Frontend: `/sprint-2/activity-log/page.tsx`

**Historique d'activité:**
- **Timeline**: Chronologie complète des actions
- **Filtres**: Par type, date, produit
- **Export**: Données d'audit
- **Détails**: Vue granulaire des événements

#### Backend: APIs d'activité

**GET /client/:clientId/activity**
```javascript
// Paramètres: ?limit=50&offset=0&filter=type
// Retourne: Historique paginé des actions
```

### Données d'activité trackées

- **Connexions**: Logs de login/logout
- **Transferts**: Demandes et approbations
- **Documents**: Accès et téléchargements
- **QR**: Générations et utilisations
- **Sécurité**: Modifications de paramètres

## 11. GESTION DES PROXIES

### Interface proxy

#### Frontend: `/sprint-2/proxy/page.tsx`

**Gestion des représentants:**
- **Ajout proxy**: Désignation de représentants légaux
- **Types**: viewer, legal_proxy, inheritance_heir
- **Documentation**: Upload de documents légaux
- **Statuts**: Validation administrative

#### Backend: APIs proxy

**POST /client/:clientId/proxy**
```javascript
{
  proxy_name: string,
  proxy_email: string,
  relationship: string,
  role: 'viewer' | 'legal_proxy' | 'inheritance_heir',
  country: string,
  additional_notes: string
}
```

### Table `proxy_assignments`
```sql
CREATE TABLE proxy_assignments (
    id SERIAL PRIMARY KEY,
    client_id INTEGER NOT NULL,
    proxy_name VARCHAR(255) NOT NULL,
    proxy_email VARCHAR(255),
    relationship VARCHAR(100) NOT NULL,
    role VARCHAR(50) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending_review',
    id_document_url VARCHAR(255),
    legal_document_url VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## 12. PLANIFICATION SUCCESSORALE

### Interface héritage

#### Frontend: `/sprint-2/inheritance-plan/page.tsx`

**Planification d'héritage:**
- **Bénéficiaires**: Désignation des héritiers
- **Conditions**: Règles de transmission
- **Documentation**: Testaments et documents légaux
- **Activation**: Processus de déclenchement

### Fonctionnalités successorales

- **Plans d'héritage**: Configurations personnalisées
- **Héritiers multiples**: Gestion de plusieurs bénéficiaires
- **Conditions d'activation**: Déclencheurs automatiques
- **Documentation légale**: Support de documents officiels

## 13. SUIVI DES ÉVALUATIONS

### Interface évaluations

#### Frontend: `/sprint-2/valuation-history/page.tsx`

**Historique des évaluations:**
- **Timeline**: Évolution des valeurs dans le temps
- **Types**: Market, insurance, auction, appraisal
- **Graphiques**: Visualisation des tendances
- **Demandes**: Nouvelle évaluation professionnelle

### Données d'évaluation

```typescript
interface Valuation {
  id: number;
  passport_id: number;
  valuation_type: 'market' | 'insurance' | 'auction' | 'appraisal';
  valuation_amount: number;
  currency: string;
  valuation_date: string;
  appraiser_name: string;
  confidence_level: 'low' | 'medium' | 'high' | 'certified';
}
```

## 14. PROGRAMME DE RÉCOMPENSES

### Interface rewards

#### Frontend: `/sprint-2/rewards/page.tsx`

**Programme de fidélité:**
- **Balance MoneySBT**: Points de cashback accumulés
- **Historique**: Transactions de récompenses
- **Utilisation**: Échange contre services
- **Niveaux**: Système de tiers de fidélité

### Système MoneySBT

- **Calcul**: 2% de cashback sur transactions
- **Accumulation**: Balance persistante
- **Utilisation**: Services premium, frais réduits
- **Transfert**: Non transférable (Soul Bound)

## 15. ARCHITECTURE ET SÉCURITÉ

### Protection des routes

Toutes les pages Sprint 2 (sauf login) sont protégées par:
```typescript
// Layout avec authentification obligatoire
if (pathname !== '/sprint-2/login-client') {
  return <ClientDashboardLayout>{children}</ClientDashboardLayout>;
}
```

### Isolation des données

```javascript
// Middleware de sécurité backend
function requireAuth(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  const payload = verifyAuthToken(token);
  req.clientId = payload.clientId;  // Limitation aux données du client
  next();
}
```

### APIs sécurisées

Toutes les APIs client vérifient:
1. **Token valide**: JWT non expiré
2. **Client ID**: Correspondance entre token et ressource
3. **Permissions**: Accès limité aux données propres
4. **Audit**: Logging de toutes les actions

## 16. INTÉGRATION AVEC SPRINT 1-3

### Connexion avec l'admin

L'interface client se connecte directement aux données créées par l'interface admin:

1. **Clients**: Créés via Sprint 1 → Accessibles via Sprint 2
2. **Passeports**: Assignés via Sprint 1 → Visibles dans vault Sprint 2
3. **SBT**: Mintés via Sprint 1 → Trackés dans wallet Sprint 2
4. **Transferts**: Demandés via Sprint 2 → Gérés via Sprint 3
5. **Documents**: Générés pour Sprint 2 → Basés sur données Sprint 1

### Flux de données bidirectionnel

```
Sprint 1 (Admin) → Création → Sprint 2 (Client) → Demandes → Sprint 3 (Admin)
```

## 17. EXPÉRIENCE UTILISATEUR

### Design système

- **UI moderne**: Interface clean et minimaliste
- **Responsive**: Adaptation mobile/desktop
- **Accessibilité**: Support screen readers
- **Performance**: Lazy loading et optimisations

### Interactions

- **Feedback visuel**: États de chargement et confirmations
- **Animations**: Transitions fluides
- **Notifications**: Alertes en temps réel
- **Recherche**: Filtrage instantané

## 18. DÉPLOIEMENT ET MONITORING

### Variables d'environnement
```bash
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000
NEXT_PUBLIC_FRONTEND_URL=http://localhost:3000
JWT_SECRET=your_jwt_secret
```

### Monitoring client

- **Sessions actives**: Tracking en temps réel
- **Usage patterns**: Analytics d'utilisation
- **Performance**: Métriques de chargement
- **Erreurs**: Tracking et alertes

Cette interface client constitue l'expérience utilisateur finale de la plateforme AUCTA, offrant aux propriétaires de produits de luxe un contrôle complet et sécurisé sur leurs biens authentifiés numériquement.
