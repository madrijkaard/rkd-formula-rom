// Limited 16-bit style palette for the procedural world. Colours are stored as 0xAABBGGRR (little endian ImageData).
export function rgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return (0xff000000 | ((n & 0xff) << 16) | (n & 0xff00) | ((n >> 16) & 0xff)) >>> 0;
}

const HEX = {
  grey1: '#3a3a3e', grey3: '#8c8c90', grey4: '#b8b8bc', pureWhite: '#ffffff', sky0: '#2850c8',
  sky1: '#3464d8', sky2: '#4078e4', sky3: '#5890ec', sky4: '#70a8f0', sky5: '#90c0f4', sky6: '#b0d4f8',
  cloud: '#f8f8f8', cloudShade: '#c4d4ec', tree0: '#18482a', tree1: '#2a6a34', grass0: '#2e8b3a',
  grass1: '#277a32', grassMid: '#2a8236', asphalt0: '#5a5a62', asphalt1: '#54545c', asphaltMid: '#57575f',
  speck: '#6a6a72', rubber: '#4a4a52', line: '#e8e8e8', kerbRed: '#d02020', kerbWhite: '#f0f0f0',
  kerbMid: '#e08080', runoff0: '#8a8a8c', runoff1: '#828284', runoffMid: '#868688', concrete: '#6e6e68',
  wallRed0: '#c81818', wallRed1: '#b01414', wallTop: '#f0f0f0', fence: '#b4b8bc', post: '#34343a',
  postHi: '#6a6a72', stand0: '#7a7a84', stand1: '#686872', facade: '#d8d8d8', facadeShade: '#a8a8b0',
  roof: '#dccca4', roofBeam: '#a89870', roofEdge: '#eeeeee', crowdR: '#d03030', crowdW: '#e8e8e8',
  crowdS: '#e8b088', crowdB: '#3050b0', crowdY: '#e8c030', crowdK: '#30303a', crowdG: '#40a050',
  bannerBg: '#1a2a78', bannerEdge: '#4a6ad0', gantry: '#2a2a32',
};

export const C = {};
for (const k in HEX) C[k] = rgb(HEX[k]);
