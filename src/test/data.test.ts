import { describe, it, expect } from "vitest";
import { networks } from "../lib/data";

describe("Data bundles pricing", () => {
  it("should have correct MTN prices", () => {
    const mtn = networks.find(n => n.id === "mtn");
    expect(mtn).toBeDefined();

    const expectedMtn = [
      { size: "1GB", price: 4.15 },
      { size: "2GB", price: 8.30 },
      { size: "3GB", price: 12.45 },
      { size: "4GB", price: 16.60 },
      { size: "5GB", price: 20.75 },
      { size: "6GB", price: 24.90 },
      { size: "7GB", price: 29.05 },
      { size: "8GB", price: 33.20 },
      { size: "10GB", price: 41 },
      { size: "15GB", price: 62.20 },
      { size: "20GB", price: 82.50 },
      { size: "25GB", price: 103.50 },
      { size: "30GB", price: 124.50 },
      { size: "40GB", price: 164 },
      { size: "50GB", price: 200 },
    ];

    expectedMtn.forEach(expected => {
      const bundle = mtn?.bundles.find(b => b.size === expected.size);
      expect(bundle, `MTN ${expected.size} not found`).toBeDefined();
      expect(bundle?.price, `MTN ${expected.size} price mismatch`).toBe(expected.price);
      expect(bundle?.generalPrice, `MTN ${expected.size} generalPrice mismatch`).toBe(expected.price);
    });
  });

  it("should have correct Airteltigo Premium prices", () => {
    const atPremium = networks.find(n => n.id === "at-premium");
    expect(atPremium).toBeDefined();

    const expectedAtPremium = [
      { size: "1GB", price: 4 },
      { size: "2GB", price: 8 },
      { size: "3GB", price: 12.10 },
      { size: "4GB", price: 16.10 },
      { size: "5GB", price: 20.10 },
      { size: "6GB", price: 24.10 },
      { size: "7GB", price: 28.10 },
      { size: "8GB", price: 32.10 },
      { size: "10GB", price: 40 },
      { size: "12GB", price: 48.10 },
      { size: "15GB", price: 60.20 },
      { size: "20GB", price: 80.30 },
      { size: "25GB", price: 100.30 },
      { size: "30GB", price: 120.40 },
    ];

    expectedAtPremium.forEach(expected => {
      const bundle = atPremium?.bundles.find(b => b.size === expected.size);
      expect(bundle, `AT Premium ${expected.size} not found`).toBeDefined();
      expect(bundle?.price, `AT Premium ${expected.size} price mismatch`).toBe(expected.price);
      expect(bundle?.generalPrice, `AT Premium ${expected.size} generalPrice mismatch`).toBe(expected.price);
    });
  });
});
