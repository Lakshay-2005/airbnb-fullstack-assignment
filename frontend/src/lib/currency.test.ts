// Run with `npm test` (Node's built-in test runner; no extra dependencies).
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  CURRENCY_CODES,
  convertAmount,
  formatMoney,
  formatMoneyCompact,
  isSupportedCurrency,
  niceRound,
  sanitizeCurrency,
  type RateTable,
} from "./currency.ts";

// The same demo rates the backend uses (backend/app/core/currency.py).
const RATES: RateTable = {
  INR: 84, USD: 1, EUR: 0.92, GBP: 0.79, AED: 3.6725, CAD: 1.36, AUD: 1.52, SGD: 1.34, JPY: 150,
  THB: 35, IDR: 15800, CHF: 0.88, NZD: 1.65, KRW: 1350, MYR: 4.5,
};

test("supports the fifteen required currencies in order", () => {
  assert.deepEqual([...CURRENCY_CODES], "INR USD EUR GBP AED CAD AUD SGD JPY THB IDR CHF NZD KRW MYR".split(" "));
  for (const code of CURRENCY_CODES) assert.ok(RATES[code], code);
});

// Identical vectors to backend/tests/test_currency.py::test_money_formatting_for_every_supported_currency
const VECTORS: [number, string, string][] = [
  [210000, "INR", "₹2,10,000"], [1234, "INR", "₹1,234"], [1200, "USD", "$1,200"], [150, "EUR", "€150"],
  [165, "GBP", "£165"], [1180, "AED", "AED 1,180"], [99, "CAD", "CA$99"], [99, "AUD", "A$99"],
  [99, "SGD", "S$99"], [16500, "JPY", "¥16,500"], [3500, "THB", "฿3,500"], [3300000, "IDR", "Rp 3,300,000"],
  [340, "CHF", "CHF 340"], [120, "NZD", "NZ$120"], [135000, "KRW", "₩135,000"], [450, "MYR", "RM 450"],
];
for (const [amount, code, expected] of VECTORS) {
  test(`formats ${code}`, () => assert.equal(formatMoney(amount, code), expected));
}

test("formats big rupee amounts with lakh/crore grouping and negatives", () => {
  assert.equal(formatMoney(12345678, "INR"), "₹1,23,45,678");
  assert.equal(formatMoney(-5000, "USD"), "-$5,000");
  assert.equal(formatMoney(0, "JPY"), "¥0");
});

test("conversion matches the server's rule and rounds half up", () => {
  assert.equal(convertAmount(150, "USD", "INR", RATES), 12600);
  assert.equal(convertAmount(12600, "INR", "USD", RATES), 150);
  assert.equal(convertAmount(1, "USD", "JPY", RATES), 150);
  assert.equal(convertAmount(42, "INR", "USD", RATES), 1); // exactly 0.5 -> up
  assert.equal(convertAmount(41, "INR", "USD", RATES), 0);
  assert.equal(convertAmount(300, "USD", "AED", RATES), 1102);
  assert.equal(convertAmount(500, "USD", "AED", RATES), 1836);
  assert.equal(convertAmount(5, "INR", "INR", RATES), 5);
});

test("compact money for narrow nav labels", () => {
  assert.equal(formatMoneyCompact(13000, "INR"), "₹13K");
  assert.equal(formatMoneyCompact(150, "USD"), "$150");
  assert.equal(formatMoneyCompact(23000, "JPY"), "¥23K");
  assert.equal(formatMoneyCompact(2400000, "IDR"), "Rp 2.4M");
  assert.equal(formatMoneyCompact(9999, "INR"), "₹9,999");
  assert.equal(formatMoneyCompact(550, "AED"), "AED 550");
});

test("friendly rounding for converted filter bounds", () => {
  assert.equal(niceRound(12600), 13000);
  assert.equal(niceRound(150), 150);
  assert.equal(niceRound(138), 140);
  assert.equal(niceRound(22500), 23000);
  assert.equal(niceRound(0), 0);
});

test("persisted values are validated against the supported list", () => {
  assert.equal(sanitizeCurrency("usd"), "USD");
  assert.equal(sanitizeCurrency("XYZ"), "INR");
  assert.equal(sanitizeCurrency(null), "INR");
  assert.equal(sanitizeCurrency("<script>"), "INR");
  assert.ok(isSupportedCurrency("MYR") && !isSupportedCurrency("BTC"));
});
