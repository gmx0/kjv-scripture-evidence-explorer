# Local corpus source

The selected corpus source is Bible Protector's first-party **Pure Cambridge Edition Text Format** archive.

- Download URL: <https://bibleprotector.com/TEXT-PCE.zip>
- Retrieved: 2026-10-04
- Local filename: `TEXT-PCE.zip` (gitignored)
- Archive size: 1,336,909 bytes
- Archive SHA-256: `ca6421515980a4a7387b5dbac3aa9cc586c7e6460fa1a92339b04fe58a162cf0`
- Archive member: `TEXT-PCE.txt`
- Member size: 4,492,936 bytes
- Member SHA-256: `ff6be20054adb077ab4e3ba27268a81ad9bf17fed02009393f5ce237f9c424e5`
- Member timestamp stored in ZIP: 2010-06-28 23:35:04 -04:00
- Encoding: Windows-1252, without a byte-order mark
- Line endings: CRLF

The downloaded archive itself is not committed. A clean setup must download the exact URL and verify both checksums before importing. If the publisher replaces the file, retain the previous archive rather than silently accepting the new bytes.

The publisher states on its download page that these files are presented for any use, including further publishing. The archive contains no separate license file; preserve the retrieval record and source-page snapshot in release compliance materials.

## Observed source contract

- Exactly 31,102 nonblank lines and one verse record per line.
- Exactly 66 distinct book prefixes.
- Record form: `<book-code> <chapter>:<verse> <text>`.
- Square brackets represent italics and are formatting metadata, not literal Bible punctuation.
- Double-angle-bracket spans contain headings, subscriptions, and end markers. Import them as paratext rather than silently merging them into ordinary verse tokens.
- The final record contains `<<THE END.>>`, which is source paratext rather than part of Revelation 22:21.

Project Gutenberg eBook 10 is a validation source only. It is not textually identical: for example, the selected PCE reads `Geba` at Ezra 2:26 while the current Gutenberg file reads `Gaba`, and Gutenberg does not preserve the PCE italic spans.

## External dictionary source

Phase 4 uses Princeton WordNet 3.0 only for user-approved vocabulary bridges.

- Download URL: <https://wordnetcode.princeton.edu/3.0/WNdb-3.0.tar.gz>
- Retrieved: 2026-10-04
- Local filename: `WNdb-3.0.tar.gz` (gitignored)
- Archive size: 10,518,425 bytes
- Archive SHA-256: `658b1ba191f5f98c2e9bae3e25c186013158f30ef779f191d2a44e5d25046dc8`
- License: <https://wordnet.princeton.edu/license-and-commercial-use>

Run `npm run import:wordnet` after placing the pinned archive in this directory. The importer verifies the archive checksum, extracts the eight required ASCII database files, preserves the license notice embedded in those files, and writes a derived manifest. Runtime topic lookups never call a dictionary API.
