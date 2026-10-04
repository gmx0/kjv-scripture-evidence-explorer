export interface BookDefinition {
  name: string;
  osis: string;
  aliases: readonly string[];
}

export const BOOKS: readonly BookDefinition[] = [
  ["Genesis", "Gen", ["gen", "ge", "gn"]], ["Exodus", "Exod", ["exod", "ex", "exo"]],
  ["Leviticus", "Lev", ["lev", "le", "lv"]], ["Numbers", "Num", ["num", "nu", "nm", "nb"]],
  ["Deuteronomy", "Deut", ["deut", "de", "dt"]], ["Joshua", "Josh", ["josh", "jos"]],
  ["Judges", "Judg", ["judg", "jdg", "jg"]], ["Ruth", "Ruth", ["ruth", "ru"]],
  ["1 Samuel", "1Sam", ["1 samuel", "1 sam", "1sa", "i samuel"]], ["2 Samuel", "2Sam", ["2 samuel", "2 sam", "2sa", "ii samuel"]],
  ["1 Kings", "1Kgs", ["1 kings", "1 king", "1ki", "i kings"]], ["2 Kings", "2Kgs", ["2 kings", "2 king", "2ki", "ii kings"]],
  ["1 Chronicles", "1Chr", ["1 chronicles", "1 chron", "1ch", "i chronicles"]], ["2 Chronicles", "2Chr", ["2 chronicles", "2 chron", "2ch", "ii chronicles"]],
  ["Ezra", "Ezra", ["ezra", "ezr"]], ["Nehemiah", "Neh", ["nehemiah", "neh", "ne"]],
  ["Esther", "Esth", ["esther", "esth", "est"]], ["Job", "Job", ["job"]],
  ["Psalms", "Ps", ["psalms", "psalm", "ps", "psa"]], ["Proverbs", "Prov", ["proverbs", "prov", "pr"]],
  ["Ecclesiastes", "Eccl", ["ecclesiastes", "eccl", "ecc"]], ["Song of Solomon", "Song", ["song of solomon", "song", "songs", "sos"]],
  ["Isaiah", "Isa", ["isaiah", "isa", "is"]], ["Jeremiah", "Jer", ["jeremiah", "jer", "je"]],
  ["Lamentations", "Lam", ["lamentations", "lam", "la"]], ["Ezekiel", "Ezek", ["ezekiel", "ezek", "eze"]],
  ["Daniel", "Dan", ["daniel", "dan", "da"]], ["Hosea", "Hos", ["hosea", "hos", "ho"]],
  ["Joel", "Joel", ["joel", "joe"]], ["Amos", "Amos", ["amos", "am"]],
  ["Obadiah", "Obad", ["obadiah", "obad", "ob"]], ["Jonah", "Jonah", ["jonah", "jon"]],
  ["Micah", "Mic", ["micah", "mic", "mi"]], ["Nahum", "Nah", ["nahum", "nah", "na"]],
  ["Habakkuk", "Hab", ["habakkuk", "hab"]], ["Zephaniah", "Zeph", ["zephaniah", "zeph", "zep"]],
  ["Haggai", "Hag", ["haggai", "hag"]], ["Zechariah", "Zech", ["zechariah", "zech", "zec"]],
  ["Malachi", "Mal", ["malachi", "mal"]], ["Matthew", "Matt", ["matthew", "matt", "mt"]],
  ["Mark", "Mark", ["mark", "mrk", "mk"]], ["Luke", "Luke", ["luke", "lk"]],
  ["John", "John", ["john", "joh", "jn"]], ["Acts", "Acts", ["acts", "act", "ac"]],
  ["Romans", "Rom", ["romans", "rom", "ro"]], ["1 Corinthians", "1Cor", ["1 corinthians", "1 cor", "1co", "i corinthians"]],
  ["2 Corinthians", "2Cor", ["2 corinthians", "2 cor", "2co", "ii corinthians"]], ["Galatians", "Gal", ["galatians", "gal", "ga"]],
  ["Ephesians", "Eph", ["ephesians", "eph"]], ["Philippians", "Phil", ["philippians", "phil", "php"]],
  ["Colossians", "Col", ["colossians", "col"]], ["1 Thessalonians", "1Thess", ["1 thessalonians", "1 thess", "1th"]],
  ["2 Thessalonians", "2Thess", ["2 thessalonians", "2 thess", "2th"]], ["1 Timothy", "1Tim", ["1 timothy", "1 tim", "1ti"]],
  ["2 Timothy", "2Tim", ["2 timothy", "2 tim", "2ti"]], ["Titus", "Titus", ["titus", "tit"]],
  ["Philemon", "Phlm", ["philemon", "philem", "phm"]], ["Hebrews", "Heb", ["hebrews", "heb"]],
  ["James", "Jas", ["james", "jas", "jam"]], ["1 Peter", "1Pet", ["1 peter", "1 pet", "1pe"]],
  ["2 Peter", "2Pet", ["2 peter", "2 pet", "2pe"]], ["1 John", "1John", ["1 john", "1 jn", "1jo"]],
  ["2 John", "2John", ["2 john", "2 jn", "2jo"]], ["3 John", "3John", ["3 john", "3 jn", "3jo"]],
  ["Jude", "Jude", ["jude", "jud"]], ["Revelation", "Rev", ["revelation", "rev", "re"]],
].map(([name, osis, aliases]) => ({ name: name as string, osis: osis as string, aliases: aliases as readonly string[] }));

const aliasIndex = new Map<string, number>();
BOOKS.forEach((book, index) => {
  for (const alias of [book.name, book.osis, ...book.aliases]) aliasIndex.set(alias.toLowerCase(), index);
});

export function resolveBook(input: string): { book: BookDefinition; bookOrder: number } | null {
  const index = aliasIndex.get(input.trim().replace(/\s+/g, " ").toLowerCase());
  return index === undefined ? null : { book: BOOKS[index]!, bookOrder: index + 1 };
}
