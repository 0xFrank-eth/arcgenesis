# Arc NFT Launchpad - Frontend

## Kurulum

```bash
npm install
```

## Geliştirme

```bash
npm run dev
```

Tarayıcıda http://localhost:3000 adresinde açılacaktır.

## Build

```bash
npm run build
```

## Konfigürasyon

Deploy edilen kontrat adreslerini `src/config/chains.js` dosyasında güncelleyin:

```javascript
export const CONTRACTS = {
  LAUNCHPAD: '0x...', // Deploy edilen NFTLaunchpad adresi
  USDC: '0x...',      // Arc Testnet USDC adresi
  SAMPLE_COLLECTION: '0x...' // Sample koleksiyon adresi
};
```

## Ağ Bilgileri

- **Network:** Arc Testnet
- **Chain ID:** 5042002
- **RPC URL:** https://rpc.testnet.arc.network
- **Faucet:** https://faucet.circle.com
