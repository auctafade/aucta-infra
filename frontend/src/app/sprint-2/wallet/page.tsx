"use client";

import React, { useState, useEffect } from "react";
import {
  Search,
  AlertCircle,
  CheckCircle,
  DollarSign,
  Package,
  TrendingUp,
  ExternalLink,
} from "lucide-react";

// Type definitions
interface Passport {
  id: string;
  nfc_uid: string;
  status: string;
  assigned_client_id: string | null;
  metadata?: {
    hash?: string;
  };
}

interface Valuation {
  id: string;
  currency: string;
  valuation_amount: number;
  valuation_date: string;
  appraiser_name: string;
  confidence_level: string;
}

interface NewValuation {
  amount: string;
  currency: string;
  appraiser_name: string;
  confidence_level: string;
}

const ResaleInitiatePage = () => {
  // State management
  const [passportSearch, setPassportSearch] = useState("");
  const [selectedPassport, setSelectedPassport] = useState<Passport | null>(null);
  const [ownershipValid, setOwnershipValid] = useState(false);
  const [validationError, setValidationError] = useState("");

  const [currentValuation, setCurrentValuation] = useState<Valuation | null>(null);
  const [valuationMode, setValuationMode] = useState<"view" | "request" | "input">("view");
  const [newValuation, setNewValuation] = useState<NewValuation>({
    amount: "",
    currency: "EUR",
    appraiser_name: "",
    confidence_level: "medium",
  });

  const [marketplace, setMarketplace] = useState("");
  const [externalRef, setExternalRef] = useState("");

  const [askingPrice, setAskingPrice] = useState("");
  const [minimumPrice, setMinimumPrice] = useState("");
  const [currency, setCurrency] = useState("EUR");

  const [loading, setLoading] = useState(false);
  const [submitStatus, setSubmitStatus] = useState("");

  // Mock marketplace options - replace with API call
  const marketplaces = [
    { id: "farfetch", name: "Farfetch", echo_enabled: true },
    { id: "thefloorr", name: "The Floorr", echo_enabled: true },
    { id: "vestiaire", name: "Vestiaire Collective", echo_enabled: false },
    { id: "rebag", name: "Rebag", echo_enabled: false },
    { id: "stockx", name: "StockX", echo_enabled: true },
  ];

  // ---- Helpers: shared wallet-like styles ----
  const card: React.CSSProperties = {
    background: "#fff",
    borderRadius: "16px",
    border: "1px solid #e0e0e0",
    padding: "24px",
    marginBottom: "24px",
  };

  const sectionTitle: React.CSSProperties = {
    fontSize: "18px",
    fontWeight: 500,
    marginBottom: "16px",
    display: "flex",
    alignItems: "center",
    gap: "8px",
  };

  const label: React.CSSProperties = {
    fontSize: "14px",
    fontWeight: 500,
    color: "#333",
    marginBottom: "8px",
    display: "block",
  };

  const input: React.CSSProperties = {
    width: "100%",
    padding: "12px 16px",
    border: "1px solid #e0e0e0",
    borderRadius: "8px",
    fontSize: "14px",
    background: "#fff",
  };

  const select: React.CSSProperties = {
    ...input,
    appearance: "none",
  };

  const btnBase: React.CSSProperties = {
    padding: "12px",
    borderRadius: "8px",
    fontSize: "14px",
    fontWeight: 500,
    cursor: "pointer",
    transition: "all 0.3s",
  };

  const btnPrimary: React.CSSProperties = {
    ...btnBase,
    background: "#000",
    color: "#fff",
    border: "none",
  };

  const btnSecondary: React.CSSProperties = {
    ...btnBase,
    background: "none",
    color: "#000",
    border: "1px solid #e0e0e0",
  };

  const gridTwo: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "16px",
  };

  const gridThree: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1fr",
    gap: "16px",
  };

  const banner = (type: "error" | "warn" | "success" | "info") => {
    const map = {
      error: { bg: "#fef2f2", border: "#fecaca", color: "#b91c1c" },
      warn: { bg: "#fffbeb", border: "#fde68a", color: "#92400e" },
      success: { bg: "#ecfdf5", border: "#d1fae5", color: "#065f46" },
      info: { bg: "#eff6ff", border: "#bfdbfe", color: "#1e40af" },
    }[type];
    return {
      background: map.bg,
      border: `1px solid ${map.border}`,
      borderRadius: "8px",
      padding: "12px",
      color: map.color,
      fontSize: "14px",
      display: "flex",
      alignItems: "center",
      gap: "8px",
    } as React.CSSProperties;
  };

  // ---- Actions ----

  // Search for passport
  const searchPassport = async () => {
    if (!passportSearch.trim()) return;

    setLoading(true);
    setValidationError("");
    setSelectedPassport(null);

    try {
      const response = await fetch(
        `/api/sprint3/passport/search?q=${encodeURIComponent(passportSearch)}`,
        { headers: { "Content-Type": "application/json" } }
      );

      if (!response.ok) throw new Error("Passport not found");

      const data = await response.json();
      setSelectedPassport(data);

      // Validate ownership and status
      validatePassport(data);

      // Fetch current valuation
      if (data.id) {
        fetchValuation(data.id);
      }
    } catch (error) {
      setValidationError(error instanceof Error ? error.message : "Failed to search passport");
    } finally {
      setLoading(false);
    }
  };

  // Validate passport ownership and status
  const validatePassport = (passport: Passport) => {
    setOwnershipValid(false);
    setValidationError("");

    if (!passport.assigned_client_id) {
      setValidationError("This item has no assigned owner");
      return;
    }

    if (passport.status === "FROZEN") {
      setValidationError("This item is frozen and cannot be resold");
      return;
    }

    if (passport.status === "UNDER_DISPUTE") {
      setValidationError("This item is under dispute and cannot be resold");
      return;
    }

    if (passport.status !== "ASSIGNED") {
      setValidationError("This item is not in a valid state for resale");
      return;
    }

    setOwnershipValid(true);
  };

  // Fetch current valuation
  const fetchValuation = async (passportId: string) => {
    try {
      const response = await fetch(`/api/sprint3/product-valuation/${passportId}`);
      if (response.ok) {
        const data = await response.json();
        setCurrentValuation(data);
      }
    } catch (error) {
      console.error("Failed to fetch valuation:", error);
    }
  };

  // Request new valuation
  const requestValuation = async () => {
    if (!selectedPassport?.id) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/sprint3/valuation/request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          passport_id: selectedPassport.id,
          requested_by: "admin",
          priority: "normal",
        }),
      });

      if (response.ok) {
        setValuationMode("view");
        setSubmitStatus("Valuation request created successfully");
        setTimeout(() => setSubmitStatus(""), 3000);
      } else {
        setValidationError("Failed to request valuation");
      }
    } catch {
      setValidationError("Failed to request valuation");
    } finally {
      setLoading(false);
    }
  };

  // Input new appraisal
  const saveAppraisal = async () => {
    if (!selectedPassport?.id || !newValuation.amount) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/sprint3/valuation/upsert`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          passport_id: selectedPassport.id,
          valuation_amount: parseFloat(newValuation.amount),
          currency: newValuation.currency,
          appraiser_name: newValuation.appraiser_name || "Admin",
          confidence_level: newValuation.confidence_level,
          valuation_type: "appraisal",
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setCurrentValuation(data);
        setValuationMode("view");
        setSubmitStatus("Appraisal saved successfully");
        setTimeout(() => setSubmitStatus(""), 3000);
      } else {
        setValidationError("Failed to save appraisal");
      }
    } catch {
      setValidationError("Failed to save appraisal");
    } finally {
      setLoading(false);
    }
  };

  // Submit resale initiation
  const initiateResale = async () => {
    if (!ownershipValid || !selectedPassport || !askingPrice || !marketplace) {
      setValidationError("Please complete all required fields");
      return;
    }

    if (
      minimumPrice &&
      parseFloat(minimumPrice) > parseFloat(askingPrice)
    ) {
      setValidationError("Minimum price cannot exceed asking price");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/sprint3/resale-console/initiate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          passport_id: selectedPassport.id,
          seller_id: selectedPassport.assigned_client_id,
          asking_price: parseFloat(askingPrice),
          minimum_price: parseFloat(minimumPrice) || parseFloat(askingPrice),
          currency: currency,
          marketplace_id: marketplace,
          external_listing_ref: externalRef || null,
          current_valuation_id: currentValuation?.id || null,
          metadata: {
            product_hash: selectedPassport.metadata?.hash,
            client_hash: selectedPassport.assigned_client_id,
            initiated_at: new Date().toISOString(),
          },
        }),
      });

      if (!response.ok) throw new Error("Failed to initiate resale");

      const data = await response.json();
      setSubmitStatus(`Resale initiated successfully. ID: ${data.resale_id}`);

      // Reset form after 3 seconds
      setTimeout(() => {
        setSelectedPassport(null);
        setPassportSearch("");
        setAskingPrice("");
        setMinimumPrice("");
        setMarketplace("");
        setExternalRef("");
        setSubmitStatus("");
        setCurrentValuation(null);
        setOwnershipValid(false);
        setValidationError("");
        setValuationMode("view");
      }, 3000);
    } catch (error) {
      setValidationError(error instanceof Error ? error.message : "Failed to initiate resale");
    } finally {
      setLoading(false);
    }
  };

  // ---- Render ----
  return (
    <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "0 24px" }}>
      {/* Header */}
      <div style={{ margin: "32px 0" }}>
        <h1
          style={{
            fontSize: "32px",
            fontWeight: 300,
            marginBottom: "8px",
            letterSpacing: "-0.02em",
          }}
        >
          Initiate Resale
        </h1>
        <p style={{ color: "#666", fontSize: "16px" }}>
          Select an owned item, confirm valuation, choose platform, and set your price.
        </p>
      </div>

      {/* Step 1: Select Owned Item */}
      <div style={card}>
        <h2 style={sectionTitle}>
          <Package size={20} /> Step 1: Select Owned Item
        </h2>

        <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "12px", marginBottom: "12px" }}>
          <input
            type="text"
            value={passportSearch}
            onChange={(e) => setPassportSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && searchPassport()}
            placeholder="Enter Passport ID or NFC UID"
            style={input}
          />
          <button
            onClick={searchPassport}
            disabled={loading}
            style={{ ...btnSecondary, width: "120px" }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#f5f5f5")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
          >
            <span style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>
              <Search size={16} />
              {loading ? "Searching..." : "Search"}
            </span>
          </button>
        </div>

        {selectedPassport && (
          <div
            style={{
              border: "1px solid #e0e0e0",
              borderRadius: "12px",
              padding: "16px",
              background: "#f8f9fa",
            }}
          >
            <div style={gridTwo}>
              <div>
                <p style={{ fontSize: "12px", color: "#666" }}>Passport ID</p>
                <p style={{ fontWeight: 500 }}>{selectedPassport.id}</p>
              </div>
              <div>
                <p style={{ fontSize: "12px", color: "#666" }}>NFC UID</p>
                <p style={{ fontWeight: 500 }}>{selectedPassport.nfc_uid}</p>
              </div>
              <div>
                <p style={{ fontSize: "12px", color: "#666" }}>Status</p>
                <p
                  style={{
                    fontWeight: 600,
                    color: selectedPassport.status === "ASSIGNED" ? "#16a34a" : "#dc2626",
                  }}
                >
                  {selectedPassport.status}
                </p>
              </div>
              <div>
                <p style={{ fontSize: "12px", color: "#666" }}>Owner ID</p>
                <p style={{ fontWeight: 500 }}>{selectedPassport.assigned_client_id || "No owner"}</p>
              </div>
            </div>

            {ownershipValid && (
              <div style={{ marginTop: "12px", display: "flex", alignItems: "center", gap: "8px", color: "#065f46" }}>
                <CheckCircle size={18} /> Ownership verified — Ready for resale
              </div>
            )}
          </div>
        )}

        {validationError && (
          <div style={{ ...banner("error"), marginTop: "12px" }}>
            <AlertCircle size={16} />
            {validationError}
          </div>
        )}
      </div>

      {/* Step 2: View/Edit Appraisal */}
      {selectedPassport && ownershipValid && (
        <div style={card}>
          <h2 style={sectionTitle}>
            <TrendingUp size={20} /> Step 2: Product Appraisal
          </h2>

          {valuationMode === "view" && (
            <>
              {currentValuation ? (
                <div
                  style={{
                    border: "1px solid #e0e0e0",
                    borderRadius: "12px",
                    padding: "16px",
                    background: "#f8f9fa",
                    marginBottom: "16px",
                  }}
                >
                  <div style={gridTwo}>
                    <div>
                      <p style={{ fontSize: "12px", color: "#666" }}>Valuation Amount</p>
                      <p style={{ fontSize: "20px", fontWeight: 600 }}>
                        {currentValuation.currency}{" "}
                        {currentValuation.valuation_amount?.toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <p style={{ fontSize: "12px", color: "#666" }}>Valuation Date</p>
                      <p style={{ fontWeight: 500 }}>
                        {new Date(currentValuation.valuation_date).toLocaleDateString()}
                      </p>
                    </div>
                    <div>
                      <p style={{ fontSize: "12px", color: "#666" }}>Appraiser</p>
                      <p style={{ fontWeight: 500 }}>{currentValuation.appraiser_name}</p>
                    </div>
                    <div>
                      <p style={{ fontSize: "12px", color: "#666" }}>Confidence</p>
                      <p style={{ fontWeight: 500, textTransform: "capitalize" }}>
                        {currentValuation.confidence_level}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <p style={{ color: "#666", marginBottom: "16px" }}>No current valuation available.</p>
              )}

              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  onClick={() => setValuationMode("request")}
                  style={btnSecondary}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#f5f5f5")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
                >
                  Request Valuation
                </button>
                <button
                  onClick={() => setValuationMode("input")}
                  style={btnPrimary}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#333")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "#000")}
                >
                  Input Appraisal
                </button>
              </div>
            </>
          )}

          {valuationMode === "request" && (
            <div>
              <p style={{ color: "#666", marginBottom: "16px" }}>
                This will create a valuation request for this item. The appraisal team will be notified.
              </p>
              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  onClick={requestValuation}
                  disabled={loading}
                  style={btnPrimary}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#333")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "#000")}
                >
                  {loading ? "Processing..." : "Confirm Request"}
                </button>
                <button
                  onClick={() => setValuationMode("view")}
                  style={btnSecondary}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#f5f5f5")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {valuationMode === "input" && (
            <div>
              <div style={gridTwo}>
                <div>
                  <label style={label}>Valuation Amount *</label>
                  <input
                    type="number"
                    value={newValuation.amount}
                    onChange={(e) =>
                      setNewValuation({ ...newValuation, amount: e.target.value })
                    }
                    style={input}
                  />
                </div>
                <div>
                  <label style={label}>Currency</label>
                  <select
                    value={newValuation.currency}
                    onChange={(e) =>
                      setNewValuation({ ...newValuation, currency: e.target.value })
                    }
                    style={select}
                  >
                    <option value="EUR">EUR</option>
                    <option value="USD">USD</option>
                    <option value="GBP">GBP</option>
                  </select>
                </div>
                <div>
                  <label style={label}>Appraiser Name</label>
                  <input
                    type="text"
                    value={newValuation.appraiser_name}
                    onChange={(e) =>
                      setNewValuation({ ...newValuation, appraiser_name: e.target.value })
                    }
                    placeholder="Enter appraiser name"
                    style={input}
                  />
                </div>
                <div>
                  <label style={label}>Confidence Level</label>
                  <select
                    value={newValuation.confidence_level}
                    onChange={(e) =>
                      setNewValuation({ ...newValuation, confidence_level: e.target.value })
                    }
                    style={select}
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="certified">Certified</option>
                  </select>
                </div>
              </div>
              <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
                <button
                  onClick={saveAppraisal}
                  disabled={loading || !newValuation.amount}
                  style={btnPrimary}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#333")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "#000")}
                >
                  {loading ? "Saving..." : "Save Appraisal"}
                </button>
                <button
                  onClick={() => setValuationMode("view")}
                  style={btnSecondary}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#f5f5f5")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Step 3: Choose Marketplace */}
      {selectedPassport && ownershipValid && (
        <div style={card}>
          <h2 style={sectionTitle}>
            <ExternalLink size={20} /> Step 3: Choose Resale Platform
          </h2>

          <div style={{ display: "grid", gap: "16px" }}>
            <div>
              <label style={label}>Select Marketplace *</label>
              <select
                value={marketplace}
                onChange={(e) => setMarketplace(e.target.value)}
                style={select}
              >
                <option value="">-- Select Marketplace --</option>
                {marketplaces.map((mp) => (
                  <option key={mp.id} value={mp.id}>
                    {mp.name} {mp.echo_enabled ? "(ECHO enabled)" : ""}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={label}>External Listing Reference (Optional)</label>
              <input
                type="text"
                value={externalRef}
                onChange={(e) => setExternalRef(e.target.value)}
                placeholder="e.g., FARFETCH-123456"
                style={input}
              />
            </div>
          </div>
        </div>
      )}

      {/* Step 4: Set Pricing */}
      {selectedPassport && ownershipValid && (
        <div style={card}>
          <h2 style={sectionTitle}>
            <DollarSign size={20} /> Step 4: Set Accepted Price
          </h2>

          <div style={gridThree}>
            <div>
              <label style={label}>Asking Price *</label>
              <input
                type="number"
                value={askingPrice}
                onChange={(e) => setAskingPrice(e.target.value)}
                placeholder="0.00"
                style={input}
              />
            </div>

            <div>
              <label style={label}>Minimum Acceptable</label>
              <input
                type="number"
                value={minimumPrice}
                onChange={(e) => setMinimumPrice(e.target.value)}
                placeholder="0.00"
                style={input}
              />
            </div>

            <div>
              <label style={label}>Currency</label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                style={select}
              >
                <option value="EUR">EUR</option>
                <option value="USD">USD</option>
                <option value="GBP">GBP</option>
                <option value="CHF">CHF</option>
                <option value="JPY">JPY</option>
              </select>
            </div>
          </div>

          {currentValuation && askingPrice && currentValuation.valuation_amount > 0 && (
            <div
              style={{
                marginTop: "12px",
                padding: "12px",
                background: "#eff6ff",
                border: "1px solid #bfdbfe",
                borderRadius: "8px",
                color: "#1e40af",
                fontSize: "14px",
              }}
            >
              Valuation: {currentValuation.currency}{" "}
              {currentValuation.valuation_amount?.toLocaleString()} &nbsp;|&nbsp; Asking: {currency}{" "}
              {parseFloat(askingPrice).toLocaleString()} &nbsp;(
              {(
                (parseFloat(askingPrice) / currentValuation.valuation_amount) *
                100
              ).toFixed(0)}
              % of valuation)
            </div>
          )}
        </div>
      )}

      {/* Step 5: Confirm Intent */}
      {selectedPassport && ownershipValid && (
        <div style={card}>
          <h2 style={sectionTitle}>Step 5: Confirm Intent to Transfer</h2>

          <div style={banner("warn")}>
            By initiating resale, you confirm that:
          </div>
          <ul style={{ marginTop: "8px", marginLeft: "18px", color: "#92400e", fontSize: "14px" }}>
            <li>The product will be marked as "ready_for_resale"</li>
            <li>A resale event will be created in the system</li>
            <li>ECHO activation will be triggered for supported marketplaces</li>
            <li>The current valuation and product data will be snapshot</li>
          </ul>

          <button
            onClick={initiateResale}
            disabled={loading || !askingPrice || !marketplace}
            style={{ ...btnPrimary, width: "100%", marginTop: "16px" }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#333")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "#000")}
          >
            {loading ? "Processing..." : "Initiate Resale"}
          </button>

          {submitStatus && (
            <div style={{ ...banner("success"), marginTop: "12px" }}>{submitStatus}</div>
          )}
        </div>
      )}
    </div>
  );
};

export default ResaleInitiatePage;
