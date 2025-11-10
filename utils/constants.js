const TOKENS = {
  USDC: {
    address: '0xddafbb505ad214d7b80b1f830fccc89b60fb7a83',
    decimals: 6,
    symbol: 'USDC',
    supplyAddress: '0xed56f76e9cbc6a64b821e9c016eafbd3db5436d1', 
    supplySymbol: 'armmUSDC',
    debtAddress: '0x69c731ae5f5356a779f44c355abb685d84e5e9e6',
    debtSymbol: 'debtUSDC',
  },
  WXDAI: {
    address: '0xe91d153e0b41518a2ce8dd3d7944fa863463a97d',
    decimals: 18,
    symbol: 'WXDAI',
    supplyAddress: '0x0ca4f5554dd9da6217d62d8df2816c82bba4157b',
    supplySymbol: 'armmWXDAI',
    supplyV2Address: '0x7349c9eaa538e118725a6130e0f8341509b9f8a0',
    supplyV2Symbol: 'armmWXDAI_V2',
    debtAddress: '0x9908801df7902675c3fedd6fea0294d18d5d5d34',
    debtSymbol: 'debtWXDAI',
    debtV2Address: '0x6a7ced66902d07066ad08c81179d17d0fbe36829',
    debtV2Symbol: 'debtWXDAI_V2',
  }
};

// Mapping des adresses vers les tokens pour une recherche rapide
const ADDRESS_TO_TOKEN = {
  // Adresses principales
  [TOKENS.USDC.address.toLowerCase()]: 'USDC',
  [TOKENS.WXDAI.address.toLowerCase()]: 'WXDAI',
  // Adresses de supply
  [TOKENS.USDC.supplyAddress.toLowerCase()]: 'USDC',
  [TOKENS.WXDAI.supplyAddress.toLowerCase()]: 'WXDAI',
  // Adresses de debt
  [TOKENS.USDC.debtAddress.toLowerCase()]: 'USDC',
  [TOKENS.WXDAI.debtAddress.toLowerCase()]: 'WXDAI'
};

// Adresses des contrats
const CONTRACTS = {
  RMM: '0x12a000a8a2cd339d85119c346142adb444bc5ce5',
  YAM: '0xc759aa7f9dd9720a1502c104dae4f9852bb17c14'
};

// Enum pour les tickers des tokens
const TokenTicker = {
  USDC: 'USDC',
  WXDAI: 'WXDAI',
  DEFAULT: 'ERR'
};

// Enum pour les types de transactions
const TransactionType = {
  BORROW: 'borrow',
  REPAY: 'repay',
  SUPPLY: 'supply',
  WITHDRAW: 'withdraw'
};

// Mapping des tokens sélectionnés vers leurs versions
// USDC et WXDAI sont V3, WXDAI_V2 est V2
const TOKEN_TO_VERSION = {
  USDC: 'V3',
  WXDAI: 'V3',
  WXDAI_V2: 'V2'
};

// Fonction helper pour obtenir les versions autorisées depuis les tokens sélectionnés
const getVersionsFromTokens = (selectedTokens) => {
  const versions = new Set();
  selectedTokens.forEach(token => {
    if (TOKEN_TO_VERSION[token]) {
      versions.add(TOKEN_TO_VERSION[token]);
    }
  });
  return Array.from(versions);
};

module.exports = {
  TOKENS,
  ADDRESS_TO_TOKEN,
  CONTRACTS,
  TokenTicker,
  TransactionType,
  TOKEN_TO_VERSION,
  getVersionsFromTokens
};
