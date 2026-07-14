# x402-pay

Turn any wallet into a `fetch` that pays.

x402 lets a service charge per call: it answers an unpaid request with `402 Payment Required` and the price, you pay, it serves the response. Getting a wallet is easy. Wiring that wallet to actually pay the 402 is the fiddly part. This is that part, in about three lines.

```js
import { x402pay } from 'x402-pay';

const pay = x402pay(process.env.WALLET_KEY);          // your funded wallet
const res = await pay('https://any-x402-service.com/thing', { method: 'POST', body });
```

That's it. `pay` is a drop-in `fetch`. When a call comes back `402`, it pays and retries automatically. Works with any x402 service.

## It works with the wallet you already have

Pass a private key, or any viem-compatible account (including Coinbase CDP or Privy accounts):

```js
// a raw key
const pay = x402pay('0xabc123...');

// a viem account
import { privateKeyToAccount } from 'viem/accounts';
const pay = x402pay(privateKeyToAccount(process.env.WALLET_KEY));
```

Don't have a wallet yet? [Coinbase](https://www.coinbase.com/developer-platform) and [Privy](https://privy.io) set one up in minutes. Fund it with a little USDC on Base and you're ready.

## A spend guard, so an agent can't be drained

```js
const pay = x402pay(process.env.WALLET_KEY, { maxUsd: 0.25 });
// refuses any single call that asks for more than $0.25
```

## Examples: pay a few different services

```js
const pay = x402pay(process.env.WALLET_KEY, { maxUsd: 1 });

// kenoodl Verify — check code against a contract, get a HELD/BROKE verdict
await pay('https://kenoodl.com/api/verify', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ code, contract }),
});

// any other x402 endpoint, same call
await pay('https://some-other-service.example/endpoint', { method: 'POST', body });
```

kenoodl is one service you can pay with this, not the only one. Point it anywhere that speaks x402.

## No custody, by design

x402-pay runs entirely on your machine. Your key stays with you; it's used locally to sign the payment and nothing is sent to any server here. There's no account, no relay, no place your key goes. Payment settles on-chain, peer to peer, between your wallet and the service.

## Defaults

- Chain: Base mainnet (`eip155:8453`). Override with `{ chain }`.
- Currency: whatever the service asks for (USDC on Base for most).
- Node 18+ (uses global `fetch`).

## License

MIT. Built and maintained by [kenoodl](https://kenoodl.com), offered to the x402 ecosystem. PRs welcome.
