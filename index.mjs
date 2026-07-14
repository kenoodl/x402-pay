// x402-pay — turn any wallet into a fetch that pays.
//
// The missing glue between "I have a funded wallet" and "I'm paying an x402
// service." Provider-agnostic (any wallet), service-agnostic (any x402 endpoint).
// Client-side only: it runs on your machine and never sends your key anywhere.
//
// Built from working, on-chain-tested code. Pay for a wallet at coinbase.com or
// privy.io; this is what makes that wallet actually pay.

import { wrapFetchWithPayment, x402Client } from '@x402/fetch';
import { ExactEvmScheme } from '@x402/evm/exact/client';
import { privateKeyToAccount } from 'viem/accounts';

// Base mainnet. Override via opts.chain if you're paying on another chain.
const BASE = 'eip155:8453';

// Accept whatever wallet the caller already has:
//  - a 0x private key string
//  - a viem account (privateKeyToAccount, or a wallet-provider account that
//    exposes the same signing interface, e.g. Coinbase CDP / Privy adapters)
function toAccount(wallet) {
  if (typeof wallet === 'string') {
    const key = wallet.startsWith('0x') ? wallet : `0x${wallet}`;
    return privateKeyToAccount(key);
  }
  if (wallet && typeof wallet === 'object' && wallet.address) return wallet;
  throw new Error('x402pay: pass a 0x private key or a viem-compatible account.');
}

// Decode the byte-exact price from an x402 `payment-required` header (base64
// JSON, amounts in atomic units, USDC = 6 decimals). Returns USD or null.
function priceFromHeader(header) {
  if (!header) return null;
  try {
    const decode = (b) =>
      typeof atob === 'function' ? atob(b) : Buffer.from(b, 'base64').toString('utf8');
    const accepts = (JSON.parse(decode(header)).accepts) || [];
    const amounts = accepts
      .map((a) => Number(a.maxAmountRequired ?? a.amount ?? 0) / 1e6)
      .filter((n) => n > 0);
    return amounts.length ? Math.min(...amounts) : null;
  } catch {
    return null;
  }
}

/**
 * Wrap fetch so 402 responses get paid and retried automatically.
 *
 *   const pay = x402pay(process.env.WALLET_KEY);
 *   const res = await pay('https://any-x402-service.com/endpoint', { method: 'POST', body });
 *
 * @param {string|object} wallet  0x private key, or a viem-compatible account.
 * @param {object} [opts]
 * @param {string} [opts.chain]   CAIP-2 chain id (default Base: eip155:8453).
 * @param {number} [opts.maxUsd]  Client-side spend guard: refuse any single call
 *                                that asks more than this many USD.
 * @returns {typeof fetch} a drop-in fetch that pays.
 */
export function x402pay(wallet, opts = {}) {
  const account = toAccount(wallet);
  const client = new x402Client().register(opts.chain || BASE, new ExactEvmScheme(account));
  const payFetch = wrapFetchWithPayment(fetch, client);

  if (!opts.maxUsd) return payFetch;

  // Spend guard: read the price off the unpaid 402 before letting the wrapper pay.
  return async function guardedFetch(url, init) {
    const preflight = await fetch(url, init).catch(() => null);
    if (preflight && preflight.status === 402) {
      const price = priceFromHeader(preflight.headers.get('payment-required'));
      if (price != null && price > opts.maxUsd) {
        throw new Error(
          `x402pay: this call costs $${price}, over your maxUsd of $${opts.maxUsd}. Not paying.`
        );
      }
    }
    return payFetch(url, init);
  };
}

export default x402pay;
