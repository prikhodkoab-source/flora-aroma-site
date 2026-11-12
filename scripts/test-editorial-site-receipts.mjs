import assert from "node:assert/strict";
import { createHash, generateKeyPairSync } from "node:crypto";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { readSiteReceipts } from "./editorial-site-receipts.mjs";

const slug = "kvitnyk-pislia-zamorozku";
const cid = "WC-ED-2026W46-KVITNYK-PISLIA-ZAMOROZKU";
const revision = "c308571f9851f059";
const receipt = `content/editorial-releases/${slug}.json`;
const markdown = `src/content/publications/${slug}.md`;
const allowlist = "config/editorial-release-allowlist.json";
const key = "config/editorial-release-public.pem";
const envelope = JSON.parse(readFileSync(receipt));
const proof = JSON.parse(Buffer.from(envelope.payload, "base64"));
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
assert.equal(proof.revision, revision);
assert.equal(proof.photos.length, 4);
assert.equal(proof.photos.map(p => p.role).join(","), "cover,body,body,body");
assert.equal(hash(readFileSync(markdown, "utf8").replaceAll("\r\n", "\n").split("\n---\n").slice(1).join("\n---\n")),
  "490c2f8f7089b4962ccec5c0f35b30622bcf913259a69b9550787eaa0722970d");

const dir = mkdtempSync(join(tmpdir(), "flora-receipt-test-"));
try {
  assert.equal(readSiteReceipts(dir).size, 0);
  for (const relative of [receipt, markdown, allowlist, key, ...proof.photos.map(p => "public" + p.src)]) {
    const target = join(dir, relative);
    mkdirSync(dirname(target), {recursive:true});
    cpSync(relative, target);
  }
  assert.deepEqual(readSiteReceipts(dir).get(cid), {revision, slug});
  const rejectChange = (relative, bytes, expected) => {
    const path = join(dir, relative), saved = readFileSync(path);
    try { writeFileSync(path, bytes); assert.throws(() => readSiteReceipts(dir), expected); }
    finally { writeFileSync(path, saved); }
  };
  rejectChange(markdown, Buffer.concat([readFileSync(markdown), Buffer.from("changed")]), /Changed signed article/);
  rejectChange("public" + proof.photos[1].src, Buffer.from("different photo"), /Changed signed photograph/);
  rejectChange(allowlist, "[]", /not enrolled/);
  rejectChange(key, generateKeyPairSync("ed25519").publicKey.export({type:"spki",format:"pem"}), /invalid editorial release/);
  rejectChange(receipt, JSON.stringify({...envelope, signature:Buffer.alloc(64).toString("base64")}), /invalid editorial release/);
  console.log("Exact site-only receipt verified; wrong text, photo, enrollment, key and signature rejected.");
} finally {
  rmSync(dir, {recursive:true, force:true});
}
