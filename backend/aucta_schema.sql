--
-- PostgreSQL database dump
--

-- Dumped from database version 17.5 (Postgres.app)
-- Dumped by pg_dump version 17.5 (Postgres.app)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: action_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.action_logs (
    id integer NOT NULL,
    passport_id integer,
    client_id integer,
    action character varying(100) NOT NULL,
    details jsonb,
    "timestamp" timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: action_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.action_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: action_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.action_logs_id_seq OWNED BY public.action_logs.id;


--
-- Name: audit_trail; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_trail (
    id integer NOT NULL,
    client_id integer,
    admin_user character varying(100),
    action_category character varying(50) NOT NULL,
    action_type character varying(100) NOT NULL,
    resource_type character varying(50),
    resource_id integer,
    old_values jsonb,
    new_values jsonb,
    ip_address inet,
    user_agent text,
    risk_level character varying(20) DEFAULT 'low'::character varying,
    geolocation jsonb,
    session_id character varying(255),
    "timestamp" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT audit_trail_risk_level_check CHECK (((risk_level)::text = ANY ((ARRAY['low'::character varying, 'medium'::character varying, 'high'::character varying, 'critical'::character varying])::text[])))
);


--
-- Name: audit_trail_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.audit_trail_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: audit_trail_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.audit_trail_id_seq OWNED BY public.audit_trail.id;


--
-- Name: blockchain_transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.blockchain_transactions (
    id integer NOT NULL,
    passport_id integer,
    client_id integer,
    transaction_hash character varying(66) NOT NULL,
    transaction_type character varying(50) NOT NULL,
    from_address character varying(42),
    to_address character varying(42),
    token_id character varying(100),
    gas_used bigint,
    gas_price bigint,
    block_number bigint,
    block_hash character varying(66),
    confirmation_count integer DEFAULT 0,
    status character varying(20) DEFAULT 'pending'::character varying,
    metadata jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    confirmed_at timestamp without time zone,
    CONSTRAINT blockchain_transactions_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'confirmed'::character varying, 'failed'::character varying, 'reverted'::character varying])::text[]))),
    CONSTRAINT blockchain_transactions_transaction_type_check CHECK (((transaction_type)::text = ANY ((ARRAY['mint'::character varying, 'transfer'::character varying, 'burn'::character varying, 'metadata_update'::character varying])::text[])))
);


--
-- Name: blockchain_transactions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.blockchain_transactions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: blockchain_transactions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.blockchain_transactions_id_seq OWNED BY public.blockchain_transactions.id;


--
-- Name: client_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.client_sessions (
    id integer NOT NULL,
    client_id integer,
    session_token character varying(500) NOT NULL,
    device_info jsonb,
    ip_address inet,
    location_info jsonb,
    last_activity timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    expires_at timestamp without time zone NOT NULL,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: client_sessions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.client_sessions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: client_sessions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.client_sessions_id_seq OWNED BY public.client_sessions.id;


--
-- Name: clients; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.clients (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    wallet_address character varying(255) NOT NULL,
    kyc_info text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    email character varying(255),
    phone character varying(50),
    preferred_contact character varying(50),
    street_address text,
    zip_code character varying(20),
    city character varying(100),
    country character varying(100),
    proof_of_address_status character varying(50) DEFAULT 'pending'::character varying,
    language character varying(10) DEFAULT 'en'::character varying,
    currency character varying(10) DEFAULT 'EUR'::character varying,
    enable_notifications boolean DEFAULT true,
    allow_qr_access boolean DEFAULT true,
    date_of_birth date,
    place_of_birth character varying(255),
    nationality character varying(100),
    kyc_status character varying(50) DEFAULT 'pending'::character varying,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: clients_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.clients_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: clients_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.clients_id_seq OWNED BY public.clients.id;


--
-- Name: messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.messages (
    id integer NOT NULL,
    client_id integer NOT NULL,
    sender_type character varying(50) NOT NULL,
    sender_id integer,
    subject character varying(255),
    content text NOT NULL,
    message_type character varying(50) DEFAULT 'general'::character varying,
    status character varying(50) DEFAULT 'active'::character varying,
    is_read boolean DEFAULT false,
    is_actionable boolean DEFAULT false,
    action_options jsonb,
    client_response character varying(255),
    passport_id integer,
    transfer_request_id integer,
    attachments jsonb,
    metadata jsonb,
    recipient_type character varying(50),
    message_category character varying(100),
    urgency character varying(20) DEFAULT 'normal'::character varying,
    parent_message_id integer,
    assigned_to character varying(255),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    read_at timestamp without time zone,
    responded_at timestamp without time zone,
    CONSTRAINT messages_message_type_check CHECK (((message_type)::text = ANY ((ARRAY['general'::character varying, 'transfer'::character varying, 'valuation'::character varying, 'security'::character varying, 'document'::character varying, 'authentication'::character varying, 'client_inquiry'::character varying, 'assignment_confirmation'::character varying])::text[]))),
    CONSTRAINT messages_sender_type_check CHECK (((sender_type)::text = ANY ((ARRAY['client'::character varying, 'admin'::character varying, 'system'::character varying])::text[]))),
    CONSTRAINT messages_status_check CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'archived'::character varying])::text[])))
);


--
-- Name: messages_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.messages_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: messages_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.messages_id_seq OWNED BY public.messages.id;


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notifications (
    id integer NOT NULL,
    client_id integer,
    title character varying(255) NOT NULL,
    message text NOT NULL,
    type character varying(50) DEFAULT 'info'::character varying,
    read boolean DEFAULT false,
    action_url character varying(500),
    metadata jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    expires_at timestamp without time zone,
    CONSTRAINT notifications_type_check CHECK (((type)::text = ANY ((ARRAY['info'::character varying, 'warning'::character varying, 'success'::character varying, 'error'::character varying, 'security'::character varying])::text[])))
);


--
-- Name: notifications_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.notifications_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: notifications_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.notifications_id_seq OWNED BY public.notifications.id;


--
-- Name: passports; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.passports (
    id integer NOT NULL,
    nfc_uid character varying(255) NOT NULL,
    metadata_hash character varying(255) NOT NULL,
    metadata jsonb NOT NULL,
    status character varying(50) DEFAULT 'VACANT'::character varying,
    assigned_client_id integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    collection_year character varying(50)
);


--
-- Name: passports_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.passports_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: passports_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.passports_id_seq OWNED BY public.passports.id;


--
-- Name: product_valuations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_valuations (
    id integer NOT NULL,
    passport_id integer,
    valuation_type character varying(50) NOT NULL,
    valuation_amount numeric(15,2) NOT NULL,
    currency character varying(10) DEFAULT 'EUR'::character varying,
    valuation_date date NOT NULL,
    appraiser_name character varying(255),
    appraiser_license character varying(100),
    methodology text,
    supporting_documents jsonb DEFAULT '[]'::jsonb,
    confidence_level character varying(20),
    market_conditions text,
    validity_period_months integer DEFAULT 12,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT product_valuations_confidence_level_check CHECK (((confidence_level)::text = ANY ((ARRAY['low'::character varying, 'medium'::character varying, 'high'::character varying, 'certified'::character varying])::text[]))),
    CONSTRAINT product_valuations_valuation_type_check CHECK (((valuation_type)::text = ANY ((ARRAY['market'::character varying, 'insurance'::character varying, 'auction'::character varying, 'appraisal'::character varying])::text[])))
);


--
-- Name: product_valuations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.product_valuations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: product_valuations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.product_valuations_id_seq OWNED BY public.product_valuations.id;


--
-- Name: proxy_assignments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.proxy_assignments (
    id integer NOT NULL,
    client_id integer NOT NULL,
    proxy_name character varying(255) NOT NULL,
    proxy_email character varying(255),
    proxy_wallet_address character varying(255),
    relationship character varying(100) NOT NULL,
    role character varying(50) NOT NULL,
    country character varying(100),
    additional_notes text,
    id_document_url character varying(255),
    legal_document_url character varying(255),
    status character varying(50) DEFAULT 'pending_review'::character varying,
    requested_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    activated_at timestamp without time zone,
    revoked_at timestamp without time zone,
    admin_notes text,
    created_proxy_client_id integer,
    proxy_onboarded boolean DEFAULT false
);


--
-- Name: proxy_assignments_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.proxy_assignments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: proxy_assignments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.proxy_assignments_id_seq OWNED BY public.proxy_assignments.id;


--
-- Name: qr_access_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.qr_access_tokens (
    id integer NOT NULL,
    client_id integer,
    passport_id integer,
    token character varying(255) NOT NULL,
    access_reason character varying(50) NOT NULL,
    validity_duration character varying(50) NOT NULL,
    expires_at timestamp without time zone NOT NULL,
    authorized_email character varying(255),
    authorized_name character varying(255),
    usage_type character varying(20) DEFAULT 'single'::character varying,
    used_at timestamp without time zone,
    revoked_at timestamp without time zone,
    status character varying(20) DEFAULT 'active'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: qr_access_tokens_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.qr_access_tokens_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: qr_access_tokens_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.qr_access_tokens_id_seq OWNED BY public.qr_access_tokens.id;


--
-- Name: rewards_benefits_usage; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rewards_benefits_usage (
    id integer NOT NULL,
    client_id integer,
    subscription_id integer,
    benefit_type character varying(100) NOT NULL,
    used_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    location character varying(255),
    details jsonb
);


--
-- Name: rewards_benefits_usage_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.rewards_benefits_usage_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: rewards_benefits_usage_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.rewards_benefits_usage_id_seq OWNED BY public.rewards_benefits_usage.id;


--
-- Name: rewards_cards; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rewards_cards (
    id integer NOT NULL,
    client_id integer,
    subscription_id integer,
    card_number character varying(16),
    card_type character varying(20) NOT NULL,
    status character varying(20) DEFAULT 'pending'::character varying,
    ordered_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    produced_at timestamp without time zone,
    shipped_at timestamp without time zone,
    delivered_at timestamp without time zone,
    tracking_number character varying(255),
    shipping_address jsonb,
    last_four_digits character varying(4),
    expiry_date date,
    CONSTRAINT rewards_cards_card_type_check CHECK (((card_type)::text = ANY ((ARRAY['SILVER'::character varying, 'BLACK'::character varying, 'CENTURION'::character varying])::text[]))),
    CONSTRAINT rewards_cards_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'production'::character varying, 'shipped'::character varying, 'delivered'::character varying, 'cancelled'::character varying, 'lost'::character varying, 'replaced'::character varying])::text[])))
);


--
-- Name: rewards_cards_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.rewards_cards_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: rewards_cards_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.rewards_cards_id_seq OWNED BY public.rewards_cards.id;


--
-- Name: rewards_concierge_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rewards_concierge_requests (
    id integer NOT NULL,
    client_id integer,
    subscription_id integer,
    request_type character varying(100) NOT NULL,
    priority character varying(20) DEFAULT 'normal'::character varying,
    subject text,
    description text,
    status character varying(20) DEFAULT 'pending'::character varying,
    assigned_to character varying(255),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    resolved_at timestamp without time zone,
    resolution_notes text,
    CONSTRAINT rewards_concierge_requests_priority_check CHECK (((priority)::text = ANY ((ARRAY['low'::character varying, 'normal'::character varying, 'high'::character varying, 'urgent'::character varying])::text[]))),
    CONSTRAINT rewards_concierge_requests_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'assigned'::character varying, 'in_progress'::character varying, 'resolved'::character varying, 'cancelled'::character varying])::text[])))
);


--
-- Name: rewards_concierge_requests_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.rewards_concierge_requests_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: rewards_concierge_requests_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.rewards_concierge_requests_id_seq OWNED BY public.rewards_concierge_requests.id;


--
-- Name: rewards_family_access; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rewards_family_access (
    id integer NOT NULL,
    primary_client_id integer,
    family_member_client_id integer,
    relationship character varying(50),
    access_level character varying(20),
    added_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    status character varying(20) DEFAULT 'active'::character varying,
    CONSTRAINT rewards_family_access_access_level_check CHECK (((access_level)::text = ANY ((ARRAY['view_only'::character varying, 'benefits_only'::character varying, 'full_access'::character varying])::text[]))),
    CONSTRAINT rewards_family_access_status_check CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'suspended'::character varying, 'removed'::character varying])::text[])))
);


--
-- Name: rewards_family_access_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.rewards_family_access_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: rewards_family_access_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.rewards_family_access_id_seq OWNED BY public.rewards_family_access.id;


--
-- Name: rewards_subscriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rewards_subscriptions (
    id integer NOT NULL,
    client_id integer,
    tier character varying(20) NOT NULL,
    status character varying(20) DEFAULT 'active'::character varying,
    monthly_fee numeric(10,2) NOT NULL,
    subscribed_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    cancelled_at timestamp without time zone,
    next_billing_date date,
    stripe_subscription_id character varying(255),
    CONSTRAINT rewards_subscriptions_status_check CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'paused'::character varying, 'cancelled'::character varying])::text[]))),
    CONSTRAINT rewards_subscriptions_tier_check CHECK (((tier)::text = ANY ((ARRAY['TIER_I'::character varying, 'TIER_II'::character varying, 'TIER_III'::character varying])::text[])))
);


--
-- Name: rewards_subscriptions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.rewards_subscriptions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: rewards_subscriptions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.rewards_subscriptions_id_seq OWNED BY public.rewards_subscriptions.id;


--
-- Name: rewards_tier_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rewards_tier_history (
    id integer NOT NULL,
    client_id integer,
    previous_tier character varying(20),
    new_tier character varying(20),
    vault_value_at_change numeric(12,2),
    changed_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    change_reason character varying(100)
);


--
-- Name: rewards_tier_history_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.rewards_tier_history_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: rewards_tier_history_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.rewards_tier_history_id_seq OWNED BY public.rewards_tier_history.id;


--
-- Name: rewards_transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rewards_transactions (
    id integer NOT NULL,
    client_id integer,
    subscription_id integer,
    transaction_type character varying(50) NOT NULL,
    amount numeric(10,2),
    description text,
    related_passport_id integer,
    metadata jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: rewards_transactions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.rewards_transactions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: rewards_transactions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.rewards_transactions_id_seq OWNED BY public.rewards_transactions.id;


--
-- Name: sbts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sbts (
    id integer NOT NULL,
    passport_id integer,
    client_id integer,
    sbt_hash character varying(255) NOT NULL,
    blockchain_tx_hash character varying(255),
    minted_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: sbts_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.sbts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: sbts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.sbts_id_seq OWNED BY public.sbts.id;


--
-- Name: security_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.security_settings (
    id integer NOT NULL,
    client_id integer,
    two_factor_enabled boolean DEFAULT false,
    two_factor_method character varying(20),
    geo_tracking_enabled boolean DEFAULT false,
    login_notifications boolean DEFAULT true,
    suspicious_activity_alerts boolean DEFAULT true,
    require_biometric_for_transfers boolean DEFAULT false,
    session_timeout_minutes integer DEFAULT 60,
    max_concurrent_sessions integer DEFAULT 3,
    trusted_devices jsonb DEFAULT '[]'::jsonb,
    security_questions jsonb,
    last_password_change timestamp without time zone,
    failed_login_attempts integer DEFAULT 0,
    account_locked_until timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT security_settings_two_factor_method_check CHECK (((two_factor_method)::text = ANY ((ARRAY['sms'::character varying, 'email'::character varying, 'authenticator'::character varying, 'faceid'::character varying])::text[])))
);


--
-- Name: security_settings_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.security_settings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: security_settings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.security_settings_id_seq OWNED BY public.security_settings.id;


--
-- Name: system_maintenance; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.system_maintenance (
    id integer NOT NULL,
    title character varying(255) NOT NULL,
    description text,
    maintenance_type character varying(50) DEFAULT 'scheduled'::character varying,
    start_time timestamp without time zone NOT NULL,
    end_time timestamp without time zone NOT NULL,
    affected_services jsonb DEFAULT '[]'::jsonb,
    status character varying(50) DEFAULT 'scheduled'::character varying,
    notify_clients boolean DEFAULT true,
    created_by character varying(100),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT system_maintenance_maintenance_type_check CHECK (((maintenance_type)::text = ANY ((ARRAY['scheduled'::character varying, 'emergency'::character varying, 'security'::character varying])::text[]))),
    CONSTRAINT system_maintenance_status_check CHECK (((status)::text = ANY ((ARRAY['scheduled'::character varying, 'in_progress'::character varying, 'completed'::character varying, 'cancelled'::character varying])::text[])))
);


--
-- Name: system_maintenance_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.system_maintenance_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: system_maintenance_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.system_maintenance_id_seq OWNED BY public.system_maintenance.id;


--
-- Name: transfer_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.transfer_requests (
    id integer NOT NULL,
    client_id integer NOT NULL,
    product_id integer NOT NULL,
    reason character varying(100) NOT NULL,
    is_resale boolean DEFAULT false,
    recipient_wallet_address character varying(255),
    recipient_first_name character varying(255),
    recipient_last_name character varying(255),
    recipient_email character varying(255),
    status character varying(50) DEFAULT 'pending'::character varying,
    admin_notes text,
    blockchain_tx_hash character varying(255),
    completed_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    client_acknowledged boolean DEFAULT false,
    CONSTRAINT recipient_info_check CHECK (((recipient_wallet_address IS NOT NULL) OR ((recipient_first_name IS NOT NULL) AND (recipient_last_name IS NOT NULL) AND (recipient_email IS NOT NULL)))),
    CONSTRAINT transfer_requests_reason_check CHECK (((reason)::text = ANY ((ARRAY['resale'::character varying, 'inheritance'::character varying, 'gift'::character varying, 'legal_assignment'::character varying])::text[]))),
    CONSTRAINT transfer_requests_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'reviewing'::character varying, 'approved'::character varying, 'rejected'::character varying, 'completed'::character varying, 'waiting_recipient'::character varying])::text[])))
);


--
-- Name: TABLE transfer_requests; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.transfer_requests IS 'Tracks all product transfer requests requiring AUCTA approval';


--
-- Name: COLUMN transfer_requests.reason; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.transfer_requests.reason IS 'Type of transfer: resale, inheritance, gift, or legal_assignment';


--
-- Name: COLUMN transfer_requests.is_resale; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.transfer_requests.is_resale IS 'Flag for resale transactions to trigger royalty logic';


--
-- Name: COLUMN transfer_requests.recipient_wallet_address; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.transfer_requests.recipient_wallet_address IS 'Wallet address if recipient already has AUCTA account';


--
-- Name: COLUMN transfer_requests.recipient_email; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.transfer_requests.recipient_email IS 'Email for sending invitation if recipient needs to join AUCTA';


--
-- Name: COLUMN transfer_requests.status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.transfer_requests.status IS 'Current status in the approval workflow';


--
-- Name: transfer_requests_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.transfer_requests_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: transfer_requests_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.transfer_requests_id_seq OWNED BY public.transfer_requests.id;


--
-- Name: valuation_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.valuation_history (
    id integer NOT NULL,
    client_id integer,
    product_id integer,
    valuation_date timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    appraised_value numeric(12,2),
    appraised_value_eth numeric(12,6),
    appraiser_name character varying(255),
    appraiser_type character varying(50),
    valuation_method character varying(100),
    certificate_url text,
    status character varying(50) DEFAULT 'completed'::character varying,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: valuation_history_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.valuation_history_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: valuation_history_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.valuation_history_id_seq OWNED BY public.valuation_history.id;


--
-- Name: valuation_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.valuation_requests (
    id integer NOT NULL,
    client_id integer,
    product_id integer,
    reason text,
    connect_authenticator boolean DEFAULT false,
    preferred_region character varying(100),
    status character varying(50) DEFAULT 'pending'::character varying,
    assigned_expert character varying(255),
    assigned_expert_info jsonb,
    admin_notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    completed_at timestamp without time zone
);


--
-- Name: valuation_requests_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.valuation_requests_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: valuation_requests_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.valuation_requests_id_seq OWNED BY public.valuation_requests.id;


--
-- Name: action_logs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.action_logs ALTER COLUMN id SET DEFAULT nextval('public.action_logs_id_seq'::regclass);


--
-- Name: audit_trail id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_trail ALTER COLUMN id SET DEFAULT nextval('public.audit_trail_id_seq'::regclass);


--
-- Name: blockchain_transactions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.blockchain_transactions ALTER COLUMN id SET DEFAULT nextval('public.blockchain_transactions_id_seq'::regclass);


--
-- Name: client_sessions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_sessions ALTER COLUMN id SET DEFAULT nextval('public.client_sessions_id_seq'::regclass);


--
-- Name: clients id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clients ALTER COLUMN id SET DEFAULT nextval('public.clients_id_seq'::regclass);


--
-- Name: messages id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages ALTER COLUMN id SET DEFAULT nextval('public.messages_id_seq'::regclass);


--
-- Name: notifications id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications ALTER COLUMN id SET DEFAULT nextval('public.notifications_id_seq'::regclass);


--
-- Name: passports id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.passports ALTER COLUMN id SET DEFAULT nextval('public.passports_id_seq'::regclass);


--
-- Name: product_valuations id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_valuations ALTER COLUMN id SET DEFAULT nextval('public.product_valuations_id_seq'::regclass);


--
-- Name: proxy_assignments id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.proxy_assignments ALTER COLUMN id SET DEFAULT nextval('public.proxy_assignments_id_seq'::regclass);


--
-- Name: qr_access_tokens id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.qr_access_tokens ALTER COLUMN id SET DEFAULT nextval('public.qr_access_tokens_id_seq'::regclass);


--
-- Name: rewards_benefits_usage id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rewards_benefits_usage ALTER COLUMN id SET DEFAULT nextval('public.rewards_benefits_usage_id_seq'::regclass);


--
-- Name: rewards_cards id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rewards_cards ALTER COLUMN id SET DEFAULT nextval('public.rewards_cards_id_seq'::regclass);


--
-- Name: rewards_concierge_requests id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rewards_concierge_requests ALTER COLUMN id SET DEFAULT nextval('public.rewards_concierge_requests_id_seq'::regclass);


--
-- Name: rewards_family_access id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rewards_family_access ALTER COLUMN id SET DEFAULT nextval('public.rewards_family_access_id_seq'::regclass);


--
-- Name: rewards_subscriptions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rewards_subscriptions ALTER COLUMN id SET DEFAULT nextval('public.rewards_subscriptions_id_seq'::regclass);


--
-- Name: rewards_tier_history id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rewards_tier_history ALTER COLUMN id SET DEFAULT nextval('public.rewards_tier_history_id_seq'::regclass);


--
-- Name: rewards_transactions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rewards_transactions ALTER COLUMN id SET DEFAULT nextval('public.rewards_transactions_id_seq'::regclass);


--
-- Name: sbts id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sbts ALTER COLUMN id SET DEFAULT nextval('public.sbts_id_seq'::regclass);


--
-- Name: security_settings id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.security_settings ALTER COLUMN id SET DEFAULT nextval('public.security_settings_id_seq'::regclass);


--
-- Name: system_maintenance id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_maintenance ALTER COLUMN id SET DEFAULT nextval('public.system_maintenance_id_seq'::regclass);


--
-- Name: transfer_requests id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transfer_requests ALTER COLUMN id SET DEFAULT nextval('public.transfer_requests_id_seq'::regclass);


--
-- Name: valuation_history id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.valuation_history ALTER COLUMN id SET DEFAULT nextval('public.valuation_history_id_seq'::regclass);


--
-- Name: valuation_requests id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.valuation_requests ALTER COLUMN id SET DEFAULT nextval('public.valuation_requests_id_seq'::regclass);


--
-- Name: action_logs action_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.action_logs
    ADD CONSTRAINT action_logs_pkey PRIMARY KEY (id);


--
-- Name: audit_trail audit_trail_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_trail
    ADD CONSTRAINT audit_trail_pkey PRIMARY KEY (id);


--
-- Name: blockchain_transactions blockchain_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.blockchain_transactions
    ADD CONSTRAINT blockchain_transactions_pkey PRIMARY KEY (id);


--
-- Name: blockchain_transactions blockchain_transactions_transaction_hash_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.blockchain_transactions
    ADD CONSTRAINT blockchain_transactions_transaction_hash_key UNIQUE (transaction_hash);


--
-- Name: client_sessions client_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_sessions
    ADD CONSTRAINT client_sessions_pkey PRIMARY KEY (id);


--
-- Name: client_sessions client_sessions_session_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_sessions
    ADD CONSTRAINT client_sessions_session_token_key UNIQUE (session_token);


--
-- Name: clients clients_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clients
    ADD CONSTRAINT clients_pkey PRIMARY KEY (id);


--
-- Name: clients clients_wallet_address_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clients
    ADD CONSTRAINT clients_wallet_address_key UNIQUE (wallet_address);


--
-- Name: messages messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: passports passports_nfc_uid_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.passports
    ADD CONSTRAINT passports_nfc_uid_key UNIQUE (nfc_uid);


--
-- Name: passports passports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.passports
    ADD CONSTRAINT passports_pkey PRIMARY KEY (id);


--
-- Name: product_valuations product_valuations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_valuations
    ADD CONSTRAINT product_valuations_pkey PRIMARY KEY (id);


--
-- Name: proxy_assignments proxy_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.proxy_assignments
    ADD CONSTRAINT proxy_assignments_pkey PRIMARY KEY (id);


--
-- Name: qr_access_tokens qr_access_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.qr_access_tokens
    ADD CONSTRAINT qr_access_tokens_pkey PRIMARY KEY (id);


--
-- Name: qr_access_tokens qr_access_tokens_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.qr_access_tokens
    ADD CONSTRAINT qr_access_tokens_token_key UNIQUE (token);


--
-- Name: rewards_benefits_usage rewards_benefits_usage_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rewards_benefits_usage
    ADD CONSTRAINT rewards_benefits_usage_pkey PRIMARY KEY (id);


--
-- Name: rewards_cards rewards_cards_card_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rewards_cards
    ADD CONSTRAINT rewards_cards_card_number_key UNIQUE (card_number);


--
-- Name: rewards_cards rewards_cards_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rewards_cards
    ADD CONSTRAINT rewards_cards_pkey PRIMARY KEY (id);


--
-- Name: rewards_concierge_requests rewards_concierge_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rewards_concierge_requests
    ADD CONSTRAINT rewards_concierge_requests_pkey PRIMARY KEY (id);


--
-- Name: rewards_family_access rewards_family_access_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rewards_family_access
    ADD CONSTRAINT rewards_family_access_pkey PRIMARY KEY (id);


--
-- Name: rewards_subscriptions rewards_subscriptions_client_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rewards_subscriptions
    ADD CONSTRAINT rewards_subscriptions_client_id_key UNIQUE (client_id);


--
-- Name: rewards_subscriptions rewards_subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rewards_subscriptions
    ADD CONSTRAINT rewards_subscriptions_pkey PRIMARY KEY (id);


--
-- Name: rewards_tier_history rewards_tier_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rewards_tier_history
    ADD CONSTRAINT rewards_tier_history_pkey PRIMARY KEY (id);


--
-- Name: rewards_transactions rewards_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rewards_transactions
    ADD CONSTRAINT rewards_transactions_pkey PRIMARY KEY (id);


--
-- Name: sbts sbts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sbts
    ADD CONSTRAINT sbts_pkey PRIMARY KEY (id);


--
-- Name: security_settings security_settings_client_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.security_settings
    ADD CONSTRAINT security_settings_client_id_key UNIQUE (client_id);


--
-- Name: security_settings security_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.security_settings
    ADD CONSTRAINT security_settings_pkey PRIMARY KEY (id);


--
-- Name: system_maintenance system_maintenance_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_maintenance
    ADD CONSTRAINT system_maintenance_pkey PRIMARY KEY (id);


--
-- Name: transfer_requests transfer_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transfer_requests
    ADD CONSTRAINT transfer_requests_pkey PRIMARY KEY (id);


--
-- Name: valuation_history valuation_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.valuation_history
    ADD CONSTRAINT valuation_history_pkey PRIMARY KEY (id);


--
-- Name: valuation_requests valuation_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.valuation_requests
    ADD CONSTRAINT valuation_requests_pkey PRIMARY KEY (id);


--
-- Name: idx_action_logs_action; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_action_logs_action ON public.action_logs USING btree (action);


--
-- Name: idx_action_logs_client_timestamp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_action_logs_client_timestamp ON public.action_logs USING btree (client_id, "timestamp" DESC);


--
-- Name: idx_action_logs_timestamp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_action_logs_timestamp ON public.action_logs USING btree ("timestamp");


--
-- Name: idx_audit_trail_client_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_trail_client_time ON public.audit_trail USING btree (client_id, "timestamp" DESC);


--
-- Name: idx_audit_trail_risk; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_trail_risk ON public.audit_trail USING btree (risk_level, "timestamp" DESC);


--
-- Name: idx_blockchain_transactions_hash; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_blockchain_transactions_hash ON public.blockchain_transactions USING btree (transaction_hash);


--
-- Name: idx_blockchain_transactions_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_blockchain_transactions_status ON public.blockchain_transactions USING btree (status);


--
-- Name: idx_client_sessions_client; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_client_sessions_client ON public.client_sessions USING btree (client_id, is_active);


--
-- Name: idx_client_sessions_token; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_client_sessions_token ON public.client_sessions USING btree (session_token);


--
-- Name: idx_clients_wallet; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_clients_wallet ON public.clients USING btree (wallet_address);


--
-- Name: idx_messages_client_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_messages_client_id ON public.messages USING btree (client_id);


--
-- Name: idx_messages_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_messages_created_at ON public.messages USING btree (created_at DESC);


--
-- Name: idx_messages_unread; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_messages_unread ON public.messages USING btree (client_id, is_read) WHERE (is_read = false);


--
-- Name: idx_notifications_client_unread; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_client_unread ON public.notifications USING btree (client_id, read);


--
-- Name: idx_passports_client; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_passports_client ON public.passports USING btree (assigned_client_id);


--
-- Name: idx_passports_nfc_uid; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_passports_nfc_uid ON public.passports USING btree (nfc_uid);


--
-- Name: idx_passports_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_passports_status ON public.passports USING btree (status);


--
-- Name: idx_qr_tokens_client; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_qr_tokens_client ON public.qr_access_tokens USING btree (client_id);


--
-- Name: idx_qr_tokens_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_qr_tokens_status ON public.qr_access_tokens USING btree (status);


--
-- Name: idx_qr_tokens_token; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_qr_tokens_token ON public.qr_access_tokens USING btree (token);


--
-- Name: idx_rewards_cards_client_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rewards_cards_client_id ON public.rewards_cards USING btree (client_id);


--
-- Name: idx_rewards_cards_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rewards_cards_status ON public.rewards_cards USING btree (status);


--
-- Name: idx_rewards_concierge_requests_client_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rewards_concierge_requests_client_id ON public.rewards_concierge_requests USING btree (client_id);


--
-- Name: idx_rewards_concierge_requests_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rewards_concierge_requests_status ON public.rewards_concierge_requests USING btree (status);


--
-- Name: idx_rewards_subscriptions_client_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rewards_subscriptions_client_id ON public.rewards_subscriptions USING btree (client_id);


--
-- Name: idx_rewards_subscriptions_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rewards_subscriptions_status ON public.rewards_subscriptions USING btree (status);


--
-- Name: idx_rewards_tier_history_client_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rewards_tier_history_client_id ON public.rewards_tier_history USING btree (client_id);


--
-- Name: idx_rewards_transactions_client_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rewards_transactions_client_id ON public.rewards_transactions USING btree (client_id);


--
-- Name: idx_rewards_transactions_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rewards_transactions_created_at ON public.rewards_transactions USING btree (created_at);


--
-- Name: idx_transfer_requests_client; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_transfer_requests_client ON public.transfer_requests USING btree (client_id);


--
-- Name: idx_transfer_requests_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_transfer_requests_created ON public.transfer_requests USING btree (created_at DESC);


--
-- Name: idx_transfer_requests_product; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_transfer_requests_product ON public.transfer_requests USING btree (product_id);


--
-- Name: idx_transfer_requests_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_transfer_requests_status ON public.transfer_requests USING btree (status);


--
-- Name: action_logs action_logs_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.action_logs
    ADD CONSTRAINT action_logs_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id);


--
-- Name: action_logs action_logs_passport_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.action_logs
    ADD CONSTRAINT action_logs_passport_id_fkey FOREIGN KEY (passport_id) REFERENCES public.passports(id);


--
-- Name: audit_trail audit_trail_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_trail
    ADD CONSTRAINT audit_trail_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id);


--
-- Name: blockchain_transactions blockchain_transactions_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.blockchain_transactions
    ADD CONSTRAINT blockchain_transactions_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id);


--
-- Name: blockchain_transactions blockchain_transactions_passport_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.blockchain_transactions
    ADD CONSTRAINT blockchain_transactions_passport_id_fkey FOREIGN KEY (passport_id) REFERENCES public.passports(id);


--
-- Name: client_sessions client_sessions_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_sessions
    ADD CONSTRAINT client_sessions_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;


--
-- Name: messages messages_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id);


--
-- Name: messages messages_parent_message_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_parent_message_id_fkey FOREIGN KEY (parent_message_id) REFERENCES public.messages(id);


--
-- Name: messages messages_passport_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_passport_id_fkey FOREIGN KEY (passport_id) REFERENCES public.passports(id);


--
-- Name: messages messages_transfer_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_transfer_request_id_fkey FOREIGN KEY (transfer_request_id) REFERENCES public.transfer_requests(id);


--
-- Name: notifications notifications_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;


--
-- Name: passports passports_assigned_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.passports
    ADD CONSTRAINT passports_assigned_client_id_fkey FOREIGN KEY (assigned_client_id) REFERENCES public.clients(id);


--
-- Name: product_valuations product_valuations_passport_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_valuations
    ADD CONSTRAINT product_valuations_passport_id_fkey FOREIGN KEY (passport_id) REFERENCES public.passports(id) ON DELETE CASCADE;


--
-- Name: proxy_assignments proxy_assignments_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.proxy_assignments
    ADD CONSTRAINT proxy_assignments_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id);


--
-- Name: proxy_assignments proxy_assignments_created_proxy_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.proxy_assignments
    ADD CONSTRAINT proxy_assignments_created_proxy_client_id_fkey FOREIGN KEY (created_proxy_client_id) REFERENCES public.clients(id);


--
-- Name: qr_access_tokens qr_access_tokens_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.qr_access_tokens
    ADD CONSTRAINT qr_access_tokens_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id);


--
-- Name: qr_access_tokens qr_access_tokens_passport_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.qr_access_tokens
    ADD CONSTRAINT qr_access_tokens_passport_id_fkey FOREIGN KEY (passport_id) REFERENCES public.passports(id);


--
-- Name: rewards_benefits_usage rewards_benefits_usage_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rewards_benefits_usage
    ADD CONSTRAINT rewards_benefits_usage_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id);


--
-- Name: rewards_benefits_usage rewards_benefits_usage_subscription_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rewards_benefits_usage
    ADD CONSTRAINT rewards_benefits_usage_subscription_id_fkey FOREIGN KEY (subscription_id) REFERENCES public.rewards_subscriptions(id);


--
-- Name: rewards_cards rewards_cards_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rewards_cards
    ADD CONSTRAINT rewards_cards_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;


--
-- Name: rewards_cards rewards_cards_subscription_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rewards_cards
    ADD CONSTRAINT rewards_cards_subscription_id_fkey FOREIGN KEY (subscription_id) REFERENCES public.rewards_subscriptions(id);


--
-- Name: rewards_concierge_requests rewards_concierge_requests_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rewards_concierge_requests
    ADD CONSTRAINT rewards_concierge_requests_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id);


--
-- Name: rewards_concierge_requests rewards_concierge_requests_subscription_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rewards_concierge_requests
    ADD CONSTRAINT rewards_concierge_requests_subscription_id_fkey FOREIGN KEY (subscription_id) REFERENCES public.rewards_subscriptions(id);


--
-- Name: rewards_family_access rewards_family_access_family_member_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rewards_family_access
    ADD CONSTRAINT rewards_family_access_family_member_client_id_fkey FOREIGN KEY (family_member_client_id) REFERENCES public.clients(id);


--
-- Name: rewards_family_access rewards_family_access_primary_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rewards_family_access
    ADD CONSTRAINT rewards_family_access_primary_client_id_fkey FOREIGN KEY (primary_client_id) REFERENCES public.clients(id);


--
-- Name: rewards_subscriptions rewards_subscriptions_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rewards_subscriptions
    ADD CONSTRAINT rewards_subscriptions_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;


--
-- Name: rewards_tier_history rewards_tier_history_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rewards_tier_history
    ADD CONSTRAINT rewards_tier_history_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id);


--
-- Name: rewards_transactions rewards_transactions_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rewards_transactions
    ADD CONSTRAINT rewards_transactions_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id);


--
-- Name: rewards_transactions rewards_transactions_related_passport_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rewards_transactions
    ADD CONSTRAINT rewards_transactions_related_passport_id_fkey FOREIGN KEY (related_passport_id) REFERENCES public.passports(id);


--
-- Name: rewards_transactions rewards_transactions_subscription_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rewards_transactions
    ADD CONSTRAINT rewards_transactions_subscription_id_fkey FOREIGN KEY (subscription_id) REFERENCES public.rewards_subscriptions(id);


--
-- Name: sbts sbts_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sbts
    ADD CONSTRAINT sbts_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id);


--
-- Name: sbts sbts_passport_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sbts
    ADD CONSTRAINT sbts_passport_id_fkey FOREIGN KEY (passport_id) REFERENCES public.passports(id);


--
-- Name: security_settings security_settings_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.security_settings
    ADD CONSTRAINT security_settings_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;


--
-- Name: transfer_requests transfer_requests_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transfer_requests
    ADD CONSTRAINT transfer_requests_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id);


--
-- Name: transfer_requests transfer_requests_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transfer_requests
    ADD CONSTRAINT transfer_requests_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.passports(id);


--
-- Name: valuation_history valuation_history_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.valuation_history
    ADD CONSTRAINT valuation_history_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id);


--
-- Name: valuation_history valuation_history_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.valuation_history
    ADD CONSTRAINT valuation_history_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.passports(id);


--
-- Name: valuation_requests valuation_requests_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.valuation_requests
    ADD CONSTRAINT valuation_requests_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id);


--
-- Name: valuation_requests valuation_requests_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.valuation_requests
    ADD CONSTRAINT valuation_requests_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.passports(id);


--
-- PostgreSQL database dump complete
--

