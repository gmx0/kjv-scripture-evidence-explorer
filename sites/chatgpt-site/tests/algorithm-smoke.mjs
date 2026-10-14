import assert from "node:assert/strict";
import {ALGORITHM_VERSION,bestLetterPattern,caseEvidence,lemmaCandidates,morphologyBetween,totalScore,wordFeatures} from "../dist/algorithm.js";

assert.equal(ALGORITHM_VERSION,"2.0.0");
const vocabulary=new Set(["free","will","self","freewill","selfwill","selfwilled"]);
assert.deepEqual(wordFeatures("freewill",vocabulary).components,new Set(["free","will"]));
assert(lemmaCandidates("selfwilled").includes("selfwill"));
assert.equal(morphologyBetween("freewill","selfwill",vocabulary,()=>1).kind,"compound_component");
assert.doesNotThrow(()=>morphologyBetween("selfwilled","selfwill",vocabulary,()=>1));
const four=bestLetterPattern("freewill","selfwill",()=>1,vocabulary.size);
const one=bestLetterPattern("free","work",()=>1,vocabulary.size);
assert.equal(four.fragment,"will");
assert(four.score>one.score&&one.score>0);
assert(caseEvidence("Spirit","Spirit",0).score>caseEvidence("Spirit","spirit",0).score);
assert.equal(totalScore({jaccard:1,phrase:1,rare:1,order:1,capitalization:1,morphology:1,letterPattern:1,crossReference:1}),1);
console.log("algorithm smoke tests passed");
