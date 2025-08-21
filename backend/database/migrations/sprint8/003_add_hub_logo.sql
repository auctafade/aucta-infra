-- Migration: Add logo field to hubs table
-- This adds support for hub logos in the management system

ALTER TABLE hubs ADD COLUMN IF NOT EXISTS logo TEXT;
