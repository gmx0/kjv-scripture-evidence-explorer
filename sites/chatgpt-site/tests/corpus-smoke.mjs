import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {bestLetterPattern,morphologyBetween,wordFeatures} from "../dist/algorithm.js";

const rows=(await readFile(new URL("../dist/data/kjv/verses.jsonl",import.meta.url),"utf8")).trim().split("\n").map(JSON.parse);
const words=new Set(rows.flatMap(row=>row.displayText.toLowerCase().match(/[a-z]+/g)||[]));
assert(words.has("freewill"));
assert(words.has("free"));
assert(words.has("will"));
assert(words.has("selfwilled"));
const freewill=wordFeatures("freewill",words);
assert(freewill.components.has("free")&&freewill.components.has("will"));
assert.equal(morphologyBetween("freewill","free",words,()=>1).kind,"compound_component");
assert.equal(morphologyBetween("freewill","selfwilled",words,()=>1).kind,"compound_component");
assert(bestLetterPattern("freewill","selfwilled",()=>1,words.size).score>bestLetterPattern("free","work",()=>1,words.size).score);
console.log(`corpus smoke tests passed (${rows.length} verses, ${words.size} word forms)`);
