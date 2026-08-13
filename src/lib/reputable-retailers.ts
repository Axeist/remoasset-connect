export type RetailerTier = 'marketplace' | 'official';

export interface ReputableRetailer {
  name: string;
  hosts: string[];
  aliases?: string[];
  tier: RetailerTier;
}

export const GLOBAL_OFFICIAL: ReputableRetailer[] = [
  { name: 'Apple', hosts: ['apple.com'], aliases: ['apple store'], tier: 'official' },
  { name: 'Dell', hosts: ['dell.com'], aliases: ['dell official'], tier: 'official' },
  { name: 'Lenovo', hosts: ['lenovo.com'], tier: 'official' },
  { name: 'HP', hosts: ['hp.com'], aliases: ['hp store'], tier: 'official' },
  { name: 'Microsoft', hosts: ['microsoft.com'], aliases: ['microsoft store'], tier: 'official' },
  { name: 'Samsung', hosts: ['samsung.com'], tier: 'official' },
  { name: 'ASUS', hosts: ['asus.com'], tier: 'official' },
  { name: 'Acer', hosts: ['acer.com'], tier: 'official' },
];

const IN: ReputableRetailer[] = [
  { name: 'Amazon.in', hosts: ['amazon.in'], aliases: ['amazon'], tier: 'marketplace' },
  { name: 'Flipkart', hosts: ['flipkart.com'], tier: 'marketplace' },
  { name: 'Croma', hosts: ['croma.com'], tier: 'marketplace' },
  { name: 'Reliance Digital', hosts: ['reliancedigital.in'], aliases: ['reliance digital'], tier: 'marketplace' },
  { name: 'Vijay Sales', hosts: ['vijaysales.com'], tier: 'marketplace' },
  { name: 'Tata CLiQ', hosts: ['tatacliq.com'], aliases: ['tata cliq'], tier: 'marketplace' },
  { name: 'JioMart', hosts: ['jiomart.com'], aliases: ['jiomart'], tier: 'marketplace' },
  { name: 'Poorvika', hosts: ['poorvika.com'], tier: 'marketplace' },
  { name: 'Sathya', hosts: ['sathya.in'], tier: 'marketplace' },
  { name: 'Aptronix', hosts: ['aptronixindia.com'], aliases: ['aptronix'], tier: 'marketplace' },
  { name: 'Imagine', hosts: ['imagineonline.store', 'imagestore.in'], aliases: ['imagine online'], tier: 'marketplace' },
  { name: 'iPlanet', hosts: ['iplanet.one'], aliases: ['iplanet'], tier: 'marketplace' },
  { name: 'Design Info', hosts: ['designinfo.in'], aliases: ['design info'], tier: 'marketplace' },
  { name: 'Maczone', hosts: ['maczone.in', 'maczone.co.in'], aliases: ['maczone'], tier: 'marketplace' },
];

const US: ReputableRetailer[] = [
  { name: 'Amazon', hosts: ['amazon.com'], aliases: ['amazon'], tier: 'marketplace' },
  { name: 'Best Buy', hosts: ['bestbuy.com'], aliases: ['best buy'], tier: 'marketplace' },
  { name: 'Walmart', hosts: ['walmart.com'], tier: 'marketplace' },
  { name: 'Costco', hosts: ['costco.com'], tier: 'marketplace' },
  { name: 'B&H Photo', hosts: ['bhphotovideo.com'], aliases: ['b&h', 'bh photo'], tier: 'marketplace' },
  { name: 'Newegg', hosts: ['newegg.com'], tier: 'marketplace' },
  { name: 'Target', hosts: ['target.com'], tier: 'marketplace' },
  { name: 'Micro Center', hosts: ['microcenter.com'], aliases: ['micro center'], tier: 'marketplace' },
  { name: 'Adorama', hosts: ['adorama.com'], tier: 'marketplace' },
  { name: 'Sam\'s Club', hosts: ['samsclub.com'], aliases: ['sams club'], tier: 'marketplace' },
];

const GB: ReputableRetailer[] = [
  { name: 'Amazon.co.uk', hosts: ['amazon.co.uk'], aliases: ['amazon'], tier: 'marketplace' },
  { name: 'Currys', hosts: ['currys.co.uk'], aliases: ['pc world'], tier: 'marketplace' },
  { name: 'John Lewis', hosts: ['johnlewis.com'], aliases: ['john lewis'], tier: 'marketplace' },
  { name: 'Argos', hosts: ['argos.co.uk'], tier: 'marketplace' },
  { name: 'Scan', hosts: ['scan.co.uk'], tier: 'marketplace' },
  { name: 'Very', hosts: ['very.co.uk'], tier: 'marketplace' },
  { name: 'AO', hosts: ['ao.com'], tier: 'marketplace' },
  { name: 'Box', hosts: ['box.co.uk'], tier: 'marketplace' },
];

const AE: ReputableRetailer[] = [
  { name: 'Amazon.ae', hosts: ['amazon.ae'], aliases: ['amazon'], tier: 'marketplace' },
  { name: 'Noon', hosts: ['noon.com'], tier: 'marketplace' },
  { name: 'Sharaf DG', hosts: ['sharafdg.com'], aliases: ['sharaf dg'], tier: 'marketplace' },
  { name: 'Jumbo', hosts: ['jumbo.ae'], aliases: ['jumbo electronics'], tier: 'marketplace' },
  { name: 'Lulu', hosts: ['luluhypermarket.com'], aliases: ['lulu hypermarket'], tier: 'marketplace' },
  { name: 'Emax', hosts: ['emaxme.com'], tier: 'marketplace' },
  { name: 'Carrefour', hosts: ['carrefouruae.com'], aliases: ['carrefour'], tier: 'marketplace' },
];

const SG: ReputableRetailer[] = [
  { name: 'Amazon.sg', hosts: ['amazon.sg'], aliases: ['amazon'], tier: 'marketplace' },
  { name: 'Lazada', hosts: ['lazada.sg'], aliases: ['lazada'], tier: 'marketplace' },
  { name: 'Shopee', hosts: ['shopee.sg'], aliases: ['shopee'], tier: 'marketplace' },
  { name: 'Courts', hosts: ['courts.com.sg'], tier: 'marketplace' },
  { name: 'Challenger', hosts: ['challenger.sg'], tier: 'marketplace' },
  { name: 'Harvey Norman', hosts: ['harveynorman.com.sg'], aliases: ['harvey norman'], tier: 'marketplace' },
];

const AU: ReputableRetailer[] = [
  { name: 'Amazon.au', hosts: ['amazon.com.au'], aliases: ['amazon'], tier: 'marketplace' },
  { name: 'JB Hi-Fi', hosts: ['jbhifi.com.au'], aliases: ['jb hi-fi', 'jbhifi'], tier: 'marketplace' },
  { name: 'The Good Guys', hosts: ['thegoodguys.com.au'], aliases: ['good guys'], tier: 'marketplace' },
  { name: 'Officeworks', hosts: ['officeworks.com.au'], tier: 'marketplace' },
  { name: 'Harvey Norman', hosts: ['harveynorman.com.au'], aliases: ['harvey norman'], tier: 'marketplace' },
];

const CA: ReputableRetailer[] = [
  { name: 'Amazon.ca', hosts: ['amazon.ca'], aliases: ['amazon'], tier: 'marketplace' },
  { name: 'Best Buy', hosts: ['bestbuy.ca'], aliases: ['best buy'], tier: 'marketplace' },
  { name: 'Canada Computers', hosts: ['canadacomputers.com'], aliases: ['canada computers'], tier: 'marketplace' },
  { name: 'Staples', hosts: ['staples.ca'], tier: 'marketplace' },
  { name: 'Memory Express', hosts: ['memoryexpress.com'], aliases: ['memory express'], tier: 'marketplace' },
];

const DE: ReputableRetailer[] = [
  { name: 'Amazon.de', hosts: ['amazon.de'], aliases: ['amazon'], tier: 'marketplace' },
  { name: 'MediaMarkt', hosts: ['mediamarkt.de'], aliases: ['media markt', 'mediamarkt'], tier: 'marketplace' },
  { name: 'Saturn', hosts: ['saturn.de'], tier: 'marketplace' },
  { name: 'Otto', hosts: ['otto.de'], tier: 'marketplace' },
  { name: 'Notebooksbilliger', hosts: ['notebooksbilliger.de'], tier: 'marketplace' },
  { name: 'Cyberport', hosts: ['cyberport.de'], tier: 'marketplace' },
];

const FR: ReputableRetailer[] = [
  { name: 'Amazon.fr', hosts: ['amazon.fr'], aliases: ['amazon'], tier: 'marketplace' },
  { name: 'Fnac', hosts: ['fnac.com'], tier: 'marketplace' },
  { name: 'Darty', hosts: ['darty.com'], tier: 'marketplace' },
  { name: 'Boulanger', hosts: ['boulanger.com'], tier: 'marketplace' },
  { name: 'LDLC', hosts: ['ldlc.com'], tier: 'marketplace' },
];

const NL: ReputableRetailer[] = [
  { name: 'Amazon.nl', hosts: ['amazon.nl'], aliases: ['amazon'], tier: 'marketplace' },
  { name: 'Coolblue', hosts: ['coolblue.nl'], tier: 'marketplace' },
  { name: 'Bol.com', hosts: ['bol.com'], tier: 'marketplace' },
  { name: 'MediaMarkt', hosts: ['mediamarkt.nl'], aliases: ['media markt', 'mediamarkt'], tier: 'marketplace' },
];

const JP: ReputableRetailer[] = [
  { name: 'Amazon.co.jp', hosts: ['amazon.co.jp'], aliases: ['amazon'], tier: 'marketplace' },
  { name: 'Bic Camera', hosts: ['biccamera.com'], aliases: ['bic camera'], tier: 'marketplace' },
  { name: 'Yodobashi', hosts: ['yodobashi.com'], tier: 'marketplace' },
  { name: 'Kakaku', hosts: ['kakaku.com'], tier: 'marketplace' },
  { name: 'Rakuten', hosts: ['rakuten.co.jp'], tier: 'marketplace' },
  { name: 'Yamada Denki', hosts: ['yamada-denki.jp'], aliases: ['yamada'], tier: 'marketplace' },
];

const KR: ReputableRetailer[] = [
  { name: 'Coupang', hosts: ['coupang.com'], tier: 'marketplace' },
  { name: 'Gmarket', hosts: ['gmarket.co.kr'], tier: 'marketplace' },
  { name: '11st', hosts: ['11st.co.kr'], aliases: ['11번가'], tier: 'marketplace' },
  { name: 'Hi-Mart', hosts: ['e-himart.co.kr'], aliases: ['himart', 'hi-mart'], tier: 'marketplace' },
];

const PH: ReputableRetailer[] = [
  { name: 'Lazada', hosts: ['lazada.com.ph'], aliases: ['lazada'], tier: 'marketplace' },
  { name: 'Shopee', hosts: ['shopee.ph'], aliases: ['shopee'], tier: 'marketplace' },
  { name: 'Beyond the Box', hosts: ['beyondthebox.ph'], aliases: ['beyond the box'], tier: 'marketplace' },
  { name: 'Digital Walker', hosts: ['digitalwalker.ph'], aliases: ['digital walker'], tier: 'marketplace' },
  { name: 'Abenson', hosts: ['abenson.com'], tier: 'marketplace' },
];

const MY: ReputableRetailer[] = [
  { name: 'Lazada', hosts: ['lazada.com.my'], aliases: ['lazada'], tier: 'marketplace' },
  { name: 'Shopee', hosts: ['shopee.com.my'], aliases: ['shopee'], tier: 'marketplace' },
  { name: 'Senheng', hosts: ['senheng.com.my'], tier: 'marketplace' },
  { name: 'Courts', hosts: ['courts.com.my'], tier: 'marketplace' },
  { name: 'Harvey Norman', hosts: ['harveynorman.com.my'], aliases: ['harvey norman'], tier: 'marketplace' },
];

const ID: ReputableRetailer[] = [
  { name: 'Tokopedia', hosts: ['tokopedia.com'], tier: 'marketplace' },
  { name: 'Shopee', hosts: ['shopee.co.id'], aliases: ['shopee'], tier: 'marketplace' },
  { name: 'Lazada', hosts: ['lazada.co.id'], aliases: ['lazada'], tier: 'marketplace' },
  { name: 'Blibli', hosts: ['blibli.com'], tier: 'marketplace' },
  { name: 'Erafone', hosts: ['erafone.com'], tier: 'marketplace' },
];

const TH: ReputableRetailer[] = [
  { name: 'Lazada', hosts: ['lazada.co.th'], aliases: ['lazada'], tier: 'marketplace' },
  { name: 'Shopee', hosts: ['shopee.co.th'], aliases: ['shopee'], tier: 'marketplace' },
  { name: 'JIB', hosts: ['jib.co.th'], tier: 'marketplace' },
  { name: 'Banana IT', hosts: ['bnn.in.th'], aliases: ['banana it'], tier: 'marketplace' },
  { name: 'Power Buy', hosts: ['powerbuy.co.th'], aliases: ['power buy'], tier: 'marketplace' },
];

const VN: ReputableRetailer[] = [
  { name: 'Shopee', hosts: ['shopee.vn'], aliases: ['shopee'], tier: 'marketplace' },
  { name: 'Lazada', hosts: ['lazada.vn'], aliases: ['lazada'], tier: 'marketplace' },
  { name: 'FPT Shop', hosts: ['fptshop.com.vn'], aliases: ['fpt shop'], tier: 'marketplace' },
  { name: 'CellphoneS', hosts: ['cellphones.com.vn'], aliases: ['cellphones'], tier: 'marketplace' },
  { name: 'The Gioi Di Dong', hosts: ['thegioididong.com'], aliases: ['tgdd'], tier: 'marketplace' },
];

const BR: ReputableRetailer[] = [
  { name: 'Mercado Livre', hosts: ['mercadolivre.com.br'], aliases: ['mercado livre', 'mercadolibre'], tier: 'marketplace' },
  { name: 'Magazine Luiza', hosts: ['magazineluiza.com.br'], aliases: ['magalu'], tier: 'marketplace' },
  { name: 'Americanas', hosts: ['americanas.com.br'], tier: 'marketplace' },
  { name: 'Amazon.com.br', hosts: ['amazon.com.br'], aliases: ['amazon'], tier: 'marketplace' },
  { name: 'KaBuM', hosts: ['kabum.com.br'], aliases: ['kabum'], tier: 'marketplace' },
];

const MX: ReputableRetailer[] = [
  { name: 'Mercado Libre', hosts: ['mercadolibre.com.mx'], aliases: ['mercado libre'], tier: 'marketplace' },
  { name: 'Amazon.com.mx', hosts: ['amazon.com.mx'], aliases: ['amazon'], tier: 'marketplace' },
  { name: 'Liverpool', hosts: ['liverpool.com.mx'], tier: 'marketplace' },
  { name: 'Coppel', hosts: ['coppel.com'], tier: 'marketplace' },
  { name: 'Sanborns', hosts: ['sanborns.com.mx'], tier: 'marketplace' },
];

const ZA: ReputableRetailer[] = [
  { name: 'Takealot', hosts: ['takealot.com'], tier: 'marketplace' },
  { name: 'Incredible Connection', hosts: ['incredible.co.za'], aliases: ['incredible connection'], tier: 'marketplace' },
  { name: 'Makro', hosts: ['makro.co.za'], tier: 'marketplace' },
  { name: 'Game', hosts: ['game.co.za'], tier: 'marketplace' },
];

const SA: ReputableRetailer[] = [
  { name: 'eXtra', hosts: ['extra.com'], aliases: ['extra.com'], tier: 'marketplace' },
  { name: 'Jarir', hosts: ['jarir.com'], tier: 'marketplace' },
  { name: 'Noon', hosts: ['noon.com'], tier: 'marketplace' },
  { name: 'Amazon.sa', hosts: ['amazon.sa'], aliases: ['amazon'], tier: 'marketplace' },
];

const CO: ReputableRetailer[] = [
  { name: 'Mercado Libre', hosts: ['mercadolibre.com.co'], aliases: ['mercado libre'], tier: 'marketplace' },
  { name: 'Alkosto', hosts: ['alkosto.com'], tier: 'marketplace' },
  { name: 'Falabella', hosts: ['falabella.com.co'], aliases: ['falabella'], tier: 'marketplace' },
  { name: 'Éxito', hosts: ['exito.com'], aliases: ['exito'], tier: 'marketplace' },
  { name: 'Ktronix', hosts: ['ktronix.com'], tier: 'marketplace' },
];

export const RETAILERS_BY_COUNTRY: Record<string, ReputableRetailer[]> = {
  in: IN, us: US, gb: GB, ae: AE, sg: SG, au: AU, ca: CA,
  de: DE, fr: FR, nl: NL, jp: JP, kr: KR, ph: PH, my: MY,
  id: ID, th: TH, vn: VN, br: BR, mx: MX, za: ZA, sa: SA, co: CO,
};

const FALLBACK: ReputableRetailer[] = [
  { name: 'Amazon', hosts: ['amazon.'], aliases: ['amazon'], tier: 'marketplace' },
];

function mergeOfficial(local: ReputableRetailer[]): ReputableRetailer[] {
  const hostSet = new Set(local.flatMap((r) => r.hosts));
  const extra = GLOBAL_OFFICIAL.filter((r) => !r.hosts.some((h) => hostSet.has(h)));
  return [...local, ...extra];
}

export function retailersForCountry(countryCode: string): ReputableRetailer[] {
  const code = countryCode.toLowerCase();
  return mergeOfficial(RETAILERS_BY_COUNTRY[code] || FALLBACK);
}

export function marketplaceRetailersForCountry(countryCode: string): ReputableRetailer[] {
  return retailersForCountry(countryCode).filter((r) => r.tier === 'marketplace');
}

export function officialRetailersForCountry(countryCode: string): ReputableRetailer[] {
  return retailersForCountry(countryCode).filter((r) => r.tier === 'official');
}

export function marketplaceNamesForCountry(countryCode: string): string[] {
  return marketplaceRetailersForCountry(countryCode).map((r) => r.name);
}

export function officialStoreForBrand(brand: string): ReputableRetailer | null {
  const key = brand.trim().toLowerCase();
  if (!key) return null;
  return GLOBAL_OFFICIAL.find((r) => r.name.toLowerCase() === key) || null;
}

export function searchSitesForCountry(countryCode: string): { name: string; host: string; tier: RetailerTier }[] {
  return retailersForCountry(countryCode).map((r) => ({
    name: r.name,
    host: r.hosts[0],
    tier: r.tier,
  }));
}

export function formatStoreList(names: string[], limit = 8): string {
  if (names.length <= limit) return names.join(', ');
  return `${names.slice(0, limit).join(', ')}, and others`;
}

function haystack(hit: { retailer: string; url: string }): string {
  return `${hit.retailer} ${hit.url}`.toLowerCase();
}

function storeMatches(hay: string, store: ReputableRetailer): boolean {
  if (store.hosts.some((h) => hay.includes(h))) return true;
  if ((store.aliases || []).some((a) => hay.includes(a.toLowerCase()))) return true;
  const name = store.name.toLowerCase();
  return name.length >= 4 && hay.includes(name);
}

export function matchRetailer(
  hit: { retailer: string; url: string },
  countryCode: string,
): ReputableRetailer | null {
  const hay = haystack(hit);
  return retailersForCountry(countryCode).find((store) => storeMatches(hay, store)) || null;
}

export function classifyRetailerHit(
  hit: { retailer: string; url: string },
  countryCode: string,
): RetailerTier | 'other' {
  return matchRetailer(hit, countryCode)?.tier || 'other';
}

const FOREIGN_TLDS: Record<string, string[]> = {
  in: ['.hr', '.de', '.fr', '.nl', '.co.uk', '.co.jp', '.com.au', '.com.br', '.com.mx', '.ca', '.sg', '.ae'],
  us: ['.in', '.co.uk', '.de', '.fr', '.co.jp', '.com.au', '.com.br'],
  gb: ['.in', '.de', '.fr', '.com.au', '.co.jp', '.com.br'],
};

export function isOffMarketListing(
  hit: { url: string; retailer?: string; currency?: string },
  countryCode: string,
  _expectedCurrency?: string,
): boolean {
  if (classifyRetailerHit({ retailer: hit.retailer || '', url: hit.url }, countryCode) !== 'other') return false;
  let host = '';
  try {
    host = new URL(hit.url).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return false;
  }
  if (host.includes('google.') || host.includes('shopping.google')) return false;
  const foreign = FOREIGN_TLDS[countryCode.toLowerCase()] || [];
  return foreign.some((tld) => host.endsWith(tld));
}

export function retailerNameFromUrl(url: string, fallback: string, countryCode: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '').toLowerCase();
    const stores = retailersForCountry(countryCode);
    const exact = stores.find((s) => s.hosts.some((h) => host === h || host.endsWith(`.${h}`) || host.includes(h)));
    return exact?.name || fallback;
  } catch {
    return fallback;
  }
}
