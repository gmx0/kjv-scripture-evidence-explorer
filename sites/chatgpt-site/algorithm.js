export const ALGORITHM_VERSION = "2.9.0";

export const TEXTUAL_CONCEPT_COUNTS = Object.freeze({word:1243,rarity:253,letter:71,order:61,line:33});
export const PROXIMITY_CONCEPT_COUNTS = Object.freeze({word:1243,book:196,letter:71,verse:33,chapter:29,testament:14});
export const FINAL_CONCEPT_COUNTS = Object.freeze({textual:1661,neighbour:129});

export const clamp = value => Math.min(1, Math.max(0, value));
export const round6 = value => Math.round((value + Number.EPSILON) * 1e6) / 1e6;

export function idf(totalDocuments, documentFrequency) {
  return Math.log((totalDocuments + 1) / (documentFrequency + 1)) + 1;
}

export function corpusRarity(maxCorpusFrequency, corpusFrequency, minCorpusFrequency = 1) {
  const maximum = Math.max(minCorpusFrequency, maxCorpusFrequency), frequency = Math.max(minCorpusFrequency, corpusFrequency);
  const denominator = 1 + Math.log((maximum + 1) / (minCorpusFrequency + 1));
  return round6(clamp((1 + Math.log((maximum + 1) / (frequency + 1))) / denominator));
}

export function wordLengthValue(input, maxWordLetters = 18) {
  const length = [...String(input)].filter(char => /\p{L}/u.test(char)).length;
  return round6(clamp(Math.log(1 + length) / Math.log(1 + Math.max(1, maxWordLetters))));
}

export function exactWordEvidence(input, rarity, maxWordLetters = 18) {
  return round6(wordLengthValue(input, maxWordLetters) * (.30 + .70 * clamp(rarity)));
}

export function repetitionValue(count, maxWithinVerse = 18) {
  return round6(clamp(Math.log(1 + Math.max(0, count)) / Math.log(1 + Math.max(1, maxWithinVerse))));
}

export function rarityConcentration(shared, rarityFor, cap = 2) {
  const evidence = shared.map(token => ({token, rarity:rarityFor(token), lengthValue:wordLengthValue(token)}));
  const score = clamp(evidence.reduce((sum,item)=>sum+item.rarity**2*item.lengthValue,0)/cap);
  return {score:round6(score),evidence};
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
  const punctuationComponents=word.split(/[\p{P}\p{S}]+/u).filter(Boolean);
  if(punctuationComponents.length>1)for(const component of punctuationComponents)components.add(component);
  return {word,lemmas,components,compounds,prefixes,suffixes,punctuationComponents};
}

function intersection(a, b) { return [...a].filter(value => b.has(value)); }

export function morphologyBetween(aInput, bInput, vocabulary, segmentEvidence = () => 1) {
  const a=aInput.toLowerCase(),b=bInput.toLowerCase();
  if(!a||!b)return {score:0,kind:null,shared:[],measurements:null};
  const letters=value=>[...value].filter(char=>/[\p{L}\p{N}]/u.test(char)).join("");
  const split=value=>value.split(/[\p{P}\p{S}]+/u).filter(Boolean);
  const compactA=letters(a),compactB=letters(b),sharedComponents=intersection(new Set(split(a)),new Set(split(b))).sort((x,y)=>y.length-x.length);
  const candidates=[
    ...(compactA&&compactA===compactB&&a!==b?[{kind:"punctuation_folded_form",fragment:compactA,position:"punctuation_folded"}]:[]),
    ...sharedComponents.map(fragment=>({kind:"punctuation_component",fragment,position:"punctuation_component"})),
    {kind:"shared_initial_segment",fragment:commonPrefix(a,b),position:"initial"},
    {kind:"shared_terminal_segment",fragment:commonSuffix(a,b),position:"terminal"},
    {kind:"shared_internal_segment",fragment:longestSubstring(a,b),position:"internal"},
  ];
  let best={score:0,kind:null,shared:[],measurements:null};
  for(const candidate of candidates){
    const n=candidate.fragment.length;if(!n)continue;
    const letterLength=letters(candidate.fragment).length;if(!letterLength)continue;
    const sourceLetters=Math.max(1,compactA.length),targetLetters=Math.max(1,compactB.length);
    const lengthValue=wordLengthValue(candidate.fragment,Math.max(sourceLetters,targetLetters));
    const sourceCoverage=letterLength/sourceLetters,targetCoverage=letterLength/targetLetters,coverage=Math.sqrt(sourceCoverage*targetCoverage);
    const observed=segmentEvidence(candidate.fragment,candidate.position),editDistance=levenshtein(a,b),transformationExactness=n/(n+editDistance);
    const rarity=typeof observed==="number"?observed:observed.rarity;
    const positionalExactness=candidate.position==="internal"?.5*(Number(a.includes(candidate.fragment))+Number(b.includes(candidate.fragment))):1;
    const score=round6(clamp(lengthValue*coverage*positionalExactness*transformationExactness));
    if(score>best.score)best={...candidate,score,shared:[candidate.fragment],measurements:{letters:letterLength,lengthValue:round6(lengthValue),sourceCoverage:round6(sourceCoverage),targetCoverage:round6(targetCoverage),coverage:round6(coverage),rarity:round6(rarity),positionalExactness:round6(positionalExactness),editDistance,transformationExactness:round6(transformationExactness),corpusFrequency:observed?.frequency??null,independentTokenFrequency:observed?.independentTokenFrequency??null}};
  }
  return best;
}

function commonPrefix(a,b){let i=0;while(i<a.length&&i<b.length&&a[i]===b[i])i++;return a.slice(0,i);}
function commonSuffix(a,b){let i=0;while(i<a.length&&i<b.length&&a.at(-1-i)===b.at(-1-i))i++;return i?a.slice(a.length-i):"";}
function longestSubstring(a,b){const row=new Array(b.length+1).fill(0);let best=0,end=0;for(let i=1;i<=a.length;i++){for(let j=b.length;j>=1;j--){row[j]=a[i-1]===b[j-1]?row[j-1]+1:0;if(row[j]>best){best=row[j];end=i;}}}return a.slice(end-best,end);}
function orderedSubsequence(a,b){const rows=Array.from({length:a.length+1},()=>new Array(b.length+1).fill(""));for(let i=1;i<=a.length;i++)for(let j=1;j<=b.length;j++)rows[i][j]=a[i-1]===b[j-1]?rows[i-1][j-1]+a[i-1]:(rows[i-1][j].length>=rows[i][j-1].length?rows[i-1][j]:rows[i][j-1]);return rows[a.length][b.length];}
function unorderedIntersection(a,b){const counts=new Map();for(const char of b)counts.set(char,(counts.get(char)||0)+1);let result="";for(const char of a)if(counts.get(char)){result+=char;counts.set(char,counts.get(char)-1);}return result;}
function levenshtein(a,b){const row=Array.from({length:b.length+1},(_,i)=>i);for(let i=1;i<=a.length;i++){let previous=row[0];row[0]=i;for(let j=1;j<=b.length;j++){const held=row[j];row[j]=Math.min(row[j]+1,row[j-1]+1,previous+(a[i-1]===b[j-1]?0:1));previous=held;}}return row[b.length];}

export function bestLetterPattern(aInput, bInput, frequency = () => 1, vocabularySize = 1, maxWordLetters = 18) {
  const a=aInput.toLowerCase(),b=bInput.toLowerCase();
  const patterns=[
    {kind:"raw_prefix",fragment:commonPrefix(a,b),multiplier:1},
    {kind:"raw_suffix",fragment:commonSuffix(a,b),multiplier:1},
    {kind:"raw_substring",fragment:longestSubstring(a,b),multiplier:1},
    {kind:"ordered_letters",fragment:orderedSubsequence(a,b),multiplier:1},
    {kind:"unordered_letters",fragment:unorderedIntersection(a,b),multiplier:1},
  ];
  let best={score:0,kind:null,fragment:"",sharedLength:0,coverage:0,rarity:0,lengthDecay:0};
  for(const pattern of patterns){
    const n=pattern.fragment.length;if(!n)continue;
    const coverage=n/Math.max(a.length,b.length),absoluteLength=Math.log(1+n)/Math.log(1+Math.max(1,maxWordLetters));
    const count=Math.max(1,frequency(pattern.fragment,pattern.kind));
    const rarity=Math.log((vocabularySize+1)/(count+1))/Math.log(vocabularySize+1);
    const score=coverage*absoluteLength*pattern.multiplier;
    if(score>best.score)best={...pattern,score:round6(score),sharedLength:n,coverage:round6(coverage),rarity:round6(rarity),absoluteLength:round6(absoluteLength)};
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
  let upperMatches=0,lowerMatches=0,caseMismatches=0;
  for(let i=0;i<length;i++){const au=aa[i]===aa[i].toUpperCase(),bu=bb[i]===bb[i].toUpperCase();if(au!==bu)caseMismatches++;else if(au)upperMatches++;else lowerMatches++;}
  const caseSimilarity=matching/Math.max(aa.length,bb.length);
  return {score:round6(caseSimilarity),caseSimilarity:round6(caseSimilarity),exactCaseMatches:matching,upperMatches,lowerMatches,caseMismatches,comparedLetters:length,initialInformation:1};
}

export function nearPhraseEvidence(a,b,maxGap=89){
  const evidence=[];
  for(let i=0;i<a.length;i++){
    for(let j=i;j<a.length;j++){
      let cursor=-1,totalGap=0,valid=true,previous=-1;
      for(let k=i;k<=j;k++){
        const found=b.indexOf(a[k],cursor+1);if(found<0){valid=false;break;}
        if(previous>=0)totalGap+=Math.max(0,found-previous-1);previous=found;cursor=found;
      }
      if(!valid)continue;
      const length=j-i+1,gapDecay=(1+Math.log((Math.max(1,maxGap)+1)/(Math.min(totalGap,maxGap)+1)))/(1+Math.log(Math.max(1,maxGap)+1)),lengthFactor=Math.log1p(length)/Math.log1p(Math.max(1,Math.min(a.length,b.length)));
      evidence.push({tokens:a.slice(i,j+1),sourceStart:i,targetStart:b.indexOf(a[i]),length,totalGap,gapDecay:round6(gapDecay),value:round6(lengthFactor*gapDecay)});
    }
  }
  evidence.sort((x,y)=>y.value-x.value||y.length-x.length||x.sourceStart-y.sourceStart);
  const selected=[],used=new Set();for(const item of evidence){const positions=Array.from({length:item.length},(_,k)=>item.sourceStart+k);if(positions.some(p=>used.has(p)))continue;positions.forEach(p=>used.add(p));selected.push(item);}
  return selected;
}

export function optimalTokenAlignment(a,b,weight=()=>1){
  const rows=Array.from({length:a.length+1},()=>new Array(b.length+1).fill(0));
  for(let i=1;i<=a.length;i++)for(let j=1;j<=b.length;j++){
    const diagonal=a[i-1]===b[j-1]?rows[i-1][j-1]+Math.max(0,weight(a[i-1])):-1;
    rows[i][j]=Math.max(diagonal,rows[i-1][j],rows[i][j-1]);
  }
  const alignment=[];let i=a.length,j=b.length;
  while(i&&j){
    const w=a[i-1]===b[j-1]?Math.max(0,weight(a[i-1])):-1;
    if(w>=0&&Math.abs(rows[i][j]-(rows[i-1][j-1]+w))<1e-12){alignment.push({token:a[i-1],sourcePosition:i-1,targetPosition:j-1,weight:round6(w)});i--;j--;}
    else if(rows[i-1][j]>=rows[i][j-1])i--;else j--;
  }
  return alignment.reverse();
}

export function orderEvidence(a,b,weight=()=>1,maxGap=89){
  const alignment=optimalTokenAlignment(a,b,weight);
  if(!alignment.length)return{score:0,alignment:[],measurements:{orderedCoverage:0,relativePosition:0,pairDirection:0,gapAgreement:0,continuity:0}};
  const recursive=values=>{const observed=values.filter(value=>value>0),sum=observed.reduce((x,y)=>x+y,0);return sum?observed.reduce((x,y)=>x+y*y,0)/sum:0;};
  const sourceWeight=a.reduce((sum,token)=>sum+Math.max(0,weight(token)),0),targetWeight=b.reduce((sum,token)=>sum+Math.max(0,weight(token)),0),matchedWeight=alignment.reduce((sum,item)=>sum+item.weight,0);
  const orderedCoverage=clamp(2*matchedWeight/(sourceWeight+targetWeight||1));
  const positionWeight=alignment.reduce((sum,item)=>sum+item.weight,0),relativePosition=positionWeight?alignment.reduce((sum,item)=>{const sp=item.sourcePosition/Math.max(1,a.length-1),tp=item.targetPosition/Math.max(1,b.length-1);return sum+item.weight*(1-Math.abs(sp-tp));},0)/positionWeight:0;
  const shared=[...new Set(a.filter(token=>b.includes(token)))],pairs=[];for(let x=0;x<shared.length;x++)for(let y=x+1;y<shared.length;y++){const left=shared[x],right=shared[y],sourceDirection=Math.sign(a.indexOf(right)-a.indexOf(left)),targetDirection=Math.sign(b.indexOf(right)-b.indexOf(left));pairs.push(sourceDirection===targetDirection);}
  const disagreements=pairs.filter(value=>!value).length,pairDirection=pairs.length?(1+Math.log((pairs.length+1)/(disagreements+1)))/(1+Math.log(pairs.length+1)):orderedCoverage;
  let gapAgreement=orderedCoverage,continuity=orderedCoverage;
  if(alignment.length>1){let gapDifference=0,totalGaps=0,adjacent=0;for(let k=1;k<alignment.length;k++){const sourceGap=Math.max(0,alignment[k].sourcePosition-alignment[k-1].sourcePosition-1),targetGap=Math.max(0,alignment[k].targetPosition-alignment[k-1].targetPosition-1);gapDifference+=Math.abs(sourceGap-targetGap);totalGaps+=sourceGap+targetGap;if(sourceGap===0&&targetGap===0)adjacent++;}gapAgreement=(1+Math.log((maxGap+1)/(Math.min(gapDifference,maxGap)+1)))/(1+Math.log(maxGap+1));continuity=(1+adjacent)/(alignment.length);}
  const measurements={orderedCoverage:round6(orderedCoverage),relativePosition:round6(relativePosition),pairDirection:round6(clamp(pairDirection)),gapAgreement:round6(clamp(gapAgreement)),continuity:round6(clamp(continuity))};
  return{score:round6(clamp(recursive(Object.values(measurements)))),alignment,measurements};
}

function weightedByCounts(values, counts) {
  const entries=Object.entries(counts), denominator=entries.reduce((sum,[,count])=>sum+count,0);
  return round6(clamp(entries.reduce((sum,[key,count])=>sum+count*clamp(values[key]||0),0)/denominator));
}

export function textualSelfRecursiveScore(components) {
  const recursive=values=>{const observed=values.filter(value=>value>0),sum=observed.reduce((a,b)=>a+b,0);return sum?clamp(observed.reduce((a,b)=>a+b*b,0)/sum):0;};
  const word=recursive([components.jaccard,components.morphology,components.phrase,components.phraseVariant]);
  const rarity=clamp(components.rarity??components.rare??0);
  const letter=recursive([components.letterPattern,components.capitalization]);
  const order=clamp(components.order||0);
  const line=clamp(components.phrase||0);
  return {score:weightedByCounts({word,rarity,letter,order,line},TEXTUAL_CONCEPT_COUNTS),groups:{word:round6(word),rarity:round6(rarity),letter:round6(letter),order:round6(order),line:round6(line)}};
}

export function proximitySelfRecursiveScore(axes) {
  return weightedByCounts(axes,PROXIMITY_CONCEPT_COUNTS);
}

export function finalEvidenceScore(textual, proximity) {
  return weightedByCounts({textual,neighbour:proximity},FINAL_CONCEPT_COUNTS);
}

export function totalScore(components) {
  const textual=textualSelfRecursiveScore(components).score;
  return finalEvidenceScore(textual,components.proximity||0);
}
