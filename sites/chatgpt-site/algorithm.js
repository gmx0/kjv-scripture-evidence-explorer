export const ALGORITHM_VERSION = "2.0.0";

export const clamp = value => Math.min(1, Math.max(0, value));
export const round6 = value => Math.round((value + Number.EPSILON) * 1e6) / 1e6;

export function idf(totalDocuments, documentFrequency) {
  return Math.log((totalDocuments + 1) / (documentFrequency + 1)) + 1;
}

export function lemmaCandidates(input) {
  const word = input.toLowerCase();
  const result = new Set([word]);
  const add = value => { if (value.length >= 2) result.add(value); };
  if (word.endsWith("ies") && word.length > 4) add(`${word.slice(0, -3)}y`);
  if (word.endsWith("ied") && word.length > 4) add(`${word.slice(0, -3)}y`);
  for (const suffix of ["ingly", "edly", "ing", "eth", "est", "ed", "es", "s"]) {
    if (!word.endsWith(suffix) || word.length <= suffix.length + 1) continue;
    const base = word.slice(0, -suffix.length);
    add(base);
    if (["ing", "ed"].includes(suffix)) {
      add(`${base}e`);
      if (base.length > 2 && base.at(-1) === base.at(-2)) add(base.slice(0, -1));
    }
  }
  return [...result];
}

const PREFIXES = ["a", "be", "con", "de", "dis", "en", "ex", "fore", "in", "mis", "non", "over", "pre", "re", "self", "sub", "trans", "un", "under"];
const SUFFIXES = ["able", "al", "ance", "dom", "ed", "en", "er", "est", "eth", "ful", "hood", "ing", "ion", "ish", "ism", "ist", "ity", "less", "ly", "ment", "ness", "ous", "ship", "ward", "wise", "y"];

export function wordFeatures(input, vocabulary = new Set()) {
  const word = input.toLowerCase();
  const lemmas = new Set(lemmaCandidates(word));
  const components = new Set();
  const compounds = [];
  for (let split = 1; split < word.length; split++) {
    const left = word.slice(0, split), right = word.slice(split);
    if (!vocabulary.has(left)) continue;
    for (const rightRoot of lemmaCandidates(right)) {
      if (!vocabulary.has(rightRoot)) continue;
      components.add(left); components.add(rightRoot);
      compounds.push({surface:word,left,right,rightRoot,split});
    }
  }
  const prefixes = PREFIXES.filter(prefix => word.startsWith(prefix) && word.length > prefix.length + 1).map(prefix => ({affix:prefix,base:word.slice(prefix.length)}));
  const suffixes = SUFFIXES.filter(suffix => word.endsWith(suffix) && word.length > suffix.length + 1).map(suffix => ({affix:suffix,base:word.slice(0, -suffix.length)}));
  return {word,lemmas,components,compounds,prefixes,suffixes};
}

function intersection(a, b) { return [...a].filter(value => b.has(value)); }

export function morphologyBetween(a, b, vocabulary, componentRarity = () => 1, featuresA = null, featuresB = null) {
  const fa = featuresA || wordFeatures(a, vocabulary), fb = featuresB || wordFeatures(b, vocabulary);
  const lemmaShared = intersection(fa.lemmas, fb.lemmas).filter(value => value !== a || value !== b);
  const componentShared = intersection(fa.components, fb.components);
  if (fa.components.has(b)) componentShared.push(b);
  if (fb.components.has(a)) componentShared.push(a);
  let relationship = null;
  if (lemmaShared.length) relationship = {kind:"lemma_or_root",baseValue:.65,shared:lemmaShared};
  if (componentShared.length) relationship = {kind:"compound_component",baseValue:.5,shared:componentShared};
  const sharesLemma = [...fa.lemmas].some(lemma => fb.lemmas.has(lemma));
  for (const pa of fa.prefixes) for (const pb of fb.prefixes) if (pa.affix === pb.affix && sharesLemma) relationship ||= {kind:"validated_prefix",baseValue:.2,shared:[pa.affix]};
  for (const sa of fa.suffixes) for (const sb of fb.suffixes) if (sa.affix === sb.affix && sharesLemma) relationship ||= {kind:"validated_suffix",baseValue:.15,shared:[sa.affix]};
  if (!relationship) return {score:0,kind:null,shared:[],sourceConfidence:0};
  const sourceConfidence = relationship.kind === "compound_component" ? .7 : .7;
  const rarity = relationship.shared.reduce((sum,value) => sum + componentRarity(value), 0) / relationship.shared.length;
  return {...relationship,sourceConfidence,componentRarity:round6(rarity),contextCompatibility:1,score:round6(relationship.baseValue * sourceConfidence * rarity)};
}

function commonPrefix(a,b){let i=0;while(i<a.length&&i<b.length&&a[i]===b[i])i++;return a.slice(0,i);}
function commonSuffix(a,b){let i=0;while(i<a.length&&i<b.length&&a.at(-1-i)===b.at(-1-i))i++;return i?a.slice(a.length-i):"";}
function longestSubstring(a,b){const row=new Array(b.length+1).fill(0);let best=0,end=0;for(let i=1;i<=a.length;i++){for(let j=b.length;j>=1;j--){row[j]=a[i-1]===b[j-1]?row[j-1]+1:0;if(row[j]>best){best=row[j];end=i;}}}return a.slice(end-best,end);}
function orderedSubsequence(a,b){const rows=Array.from({length:a.length+1},()=>new Array(b.length+1).fill(""));for(let i=1;i<=a.length;i++)for(let j=1;j<=b.length;j++)rows[i][j]=a[i-1]===b[j-1]?rows[i-1][j-1]+a[i-1]:(rows[i-1][j].length>=rows[i][j-1].length?rows[i-1][j]:rows[i][j-1]);return rows[a.length][b.length];}
function unorderedIntersection(a,b){const counts=new Map();for(const char of b)counts.set(char,(counts.get(char)||0)+1);let result="";for(const char of a)if(counts.get(char)){result+=char;counts.set(char,counts.get(char)-1);}return result;}

export function bestLetterPattern(aInput, bInput, frequency = () => 1, vocabularySize = 1) {
  const a=aInput.toLowerCase(),b=bInput.toLowerCase();
  const patterns=[
    {kind:"raw_prefix",fragment:commonPrefix(a,b),multiplier:1},
    {kind:"raw_suffix",fragment:commonSuffix(a,b),multiplier:1},
    {kind:"raw_substring",fragment:longestSubstring(a,b),multiplier:.75},
    {kind:"ordered_letters",fragment:orderedSubsequence(a,b),multiplier:.25},
    {kind:"unordered_letters",fragment:unorderedIntersection(a,b),multiplier:.1},
  ];
  let best={score:0,kind:null,fragment:"",sharedLength:0,coverage:0,rarity:0,lengthDecay:0};
  for(const pattern of patterns){
    const n=pattern.fragment.length;if(!n)continue;
    const coverage=n/Math.max(a.length,b.length),lengthDecay=Math.exp(-2.3*Math.max(0,4-n));
    const count=Math.max(1,frequency(pattern.fragment,pattern.kind));
    const rarity=Math.log((vocabularySize+1)/(count+1))/Math.log(vocabularySize+1);
    const score=coverage**3*rarity*lengthDecay*pattern.multiplier;
    if(score>best.score)best={...pattern,score:round6(score),sharedLength:n,coverage:round6(coverage),rarity:round6(rarity),lengthDecay:round6(lengthDecay)};
  }
  return best;
}

export function continuousRarity(shared, weight, maxIdf, cap=3) {
  const evidence=shared.map(token=>({token,idf:weight(token),rarity:weight(token)/maxIdf}));
  return {score:round6(clamp(evidence.reduce((sum,item)=>sum+item.rarity**2,0)/cap)),evidence};
}

export function caseEvidence(a, b, initialCount=0) {
  const aa=[...a].filter(char=>/\p{L}/u.test(char)),bb=[...b].filter(char=>/\p{L}/u.test(char)),length=Math.min(aa.length,bb.length);
  if(!length)return {score:0,caseSimilarity:0,initialInformation:0};
  let matching=0;for(let i=0;i<length;i++)if((aa[i]===aa[i].toUpperCase())===(bb[i]===bb[i].toUpperCase()))matching++;
  const caseSimilarity=matching/length,initialInformation=1/(1+.5*initialCount);
  return {score:round6(caseSimilarity*initialInformation),caseSimilarity:round6(caseSimilarity),initialInformation:round6(initialInformation)};
}

export function nearPhraseEvidence(a,b){
  const evidence=[];
  for(let i=0;i<a.length;i++){
    for(let j=i;j<a.length;j++){
      let cursor=-1,totalGap=0,valid=true,previous=-1;
      for(let k=i;k<=j;k++){
        const found=b.indexOf(a[k],cursor+1);if(found<0){valid=false;break;}
        if(previous>=0)totalGap+=Math.max(0,found-previous-1);previous=found;cursor=found;
      }
      if(!valid)continue;
      const length=j-i+1,gapDecay=Math.exp(-.7*totalGap),lengthFactor=length===1?.1:length**2;
      evidence.push({tokens:a.slice(i,j+1),sourceStart:i,targetStart:b.indexOf(a[i]),length,totalGap,gapDecay:round6(gapDecay),value:round6(lengthFactor*gapDecay)});
    }
  }
  evidence.sort((x,y)=>y.value-x.value||y.length-x.length||x.sourceStart-y.sourceStart);
  const selected=[],used=new Set();for(const item of evidence){const positions=Array.from({length:item.length},(_,k)=>item.sourceStart+k);if(positions.some(p=>used.has(p)))continue;positions.forEach(p=>used.add(p));selected.push(item);}
  return selected;
}

export function totalScore(components) {
  return round6(.30*components.jaccard+.20*components.phrase+.10*components.rare+.10*components.order+.10*components.capitalization+.10*components.morphology+.05*components.letterPattern+.05*components.crossReference);
}
